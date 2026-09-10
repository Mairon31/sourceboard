import { createIdentifier } from "../auth/crypto";
import { canViewUser } from "../privacy/policy";
import { canViewPost } from "../posts/service";
import type { ProfileStore } from "../profile/store";
import type { PostStore } from "../posts/store";
import { PostError } from "../posts/errors";
import { decodePostCursor } from "../posts/pagination";
import { normalizeCommentBody } from "./richtext";
import type { CommentEmoteAsset, CommentStore } from "./store";
import type { CommentCursor, CommentWithAuthor } from "./types";
import { normalizeEmoteShortcode } from "../../shared/richtext/markdown";
import type { CommentView, PublicPostAuthor } from "../../shared/ui/contracts";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_LIMIT = 100;

export interface CommentServiceDependencies {
  store: CommentStore;
  postStore: PostStore;
  profileStore: ProfileStore;
  assertEntitlements?: (
    userId: string,
    body: ReturnType<typeof normalizeCommentBody>,
  ) => Promise<void>;
  now?: () => number;
}

export interface CommentService {
  listForPost(
    postId: string,
    viewerId: string | null,
    cursor: string | null,
    limit: number,
  ): Promise<{
    comments: CommentView[];
    nextCursor: string | null;
  }>;
  create(input: {
    postId: string;
    authorId: string;
    parentCommentId?: string | null;
    richtext?: unknown;
    plaintext?: unknown;
    markdown?: unknown;
    attachment?: unknown;
  }): Promise<CommentView>;
  update(
    commentId: string,
    authorId: string,
    input: { richtext?: unknown; plaintext?: unknown; markdown?: unknown; attachment?: unknown },
  ): Promise<CommentView>;
  delete(commentId: string, authorId: string): Promise<void>;
  toggleLike(targetType: "POST" | "COMMENT", targetId: string, userId: string): Promise<boolean>;
  setLike(
    targetType: "POST" | "COMMENT",
    targetId: string,
    userId: string,
    liked: boolean,
  ): Promise<boolean>;
}

function publicAuthor(
  comment: CommentWithAuthor,
  profileVisible: boolean,
  cosmetics?: Awaited<ReturnType<ProfileStore["getEquippedCosmetics"]>>,
): PublicPostAuthor {
  if (
    comment.post.authorMode === "ANONYMOUS" &&
    comment.comment.authorId === comment.post.authorId
  ) {
    return { mode: "ANONYMOUS", displayName: "Anonymous Author" };
  }
  if (!profileVisible) return { mode: "IDENTIFIED", displayName: "SourceBoard member" };
  return {
    mode: "IDENTIFIED",
    displayName: comment.author.displayName,
    username: comment.author.username,
    avatarUrl: comment.author.avatarAssetId
      ? `/api/media/profile/${encodeURIComponent(comment.author.avatarAssetId)}`
      : undefined,
    profileUrl: `/u/${encodeURIComponent(comment.author.username)}`,
    avatarFrame: cosmetics?.avatarFrame,
    profileEffect: cosmetics?.profileEffect,
    nameFont: cosmetics?.nameFont,
    nameEffect: cosmetics?.nameEffect,
    visuals: cosmetics?.visuals,
  };
}

async function toView(
  record: CommentWithAuthor,
  viewerId: string | null,
  profileStore: ProfileStore,
  now: () => number,
  viewerReacted = false,
  emoteAssets: Map<string, CommentEmoteAsset> = new Map(),
): Promise<CommentView> {
  const profileVisible =
    record.post.authorMode !== "ANONYMOUS" || record.comment.authorId !== record.post.authorId
      ? await canViewUser(viewerId, record.comment.authorId, { store: profileStore, now })
      : false;
  const cosmetics = profileVisible
    ? await profileStore.getEquippedCosmetics?.(record.comment.authorId)
    : undefined;
  return {
    id: record.comment.id,
    parentCommentId: record.comment.parentCommentId ?? undefined,
    author: publicAuthor(record, profileVisible, cosmetics),
    body: record.comment.state === "DELETED" ? "Comment deleted" : record.comment.plaintext,
    richtext:
      record.comment.state === "DELETED"
        ? undefined
        : record.comment.richtext.map((node) => {
            if (node.type !== "emote") return node;
            const lookupShortcode = normalizeEmoteShortcode(node.shortcode);
            const asset = lookupShortcode ? emoteAssets.get(lookupShortcode) : undefined;
            return asset ? { ...node, id: asset.id, label: asset.label, url: asset.url } : node;
          }),
    createdAt: new Date(record.comment.createdAt).toISOString(),
    editedAt:
      record.comment.updatedAt > record.comment.createdAt
        ? new Date(record.comment.updatedAt).toISOString()
        : undefined,
    state: record.comment.state,
    reaction: { type: "LIKE", count: record.comment.likeCount, viewerReacted },
    isPostAuthor: record.comment.authorId === record.post.authorId,
    canEdit:
      record.comment.authorId === viewerId &&
      record.comment.state === "VISIBLE" &&
      record.comment.editDeadlineAt >= now(),
    canDelete: record.comment.authorId === viewerId && record.comment.state === "VISIBLE",
    canReport:
      Boolean(viewerId) &&
      record.comment.authorId !== viewerId &&
      record.comment.state === "VISIBLE",
    commentHref: `#comment-${encodeURIComponent(record.comment.id)}`,
    attachment: record.comment.attachment
      ? {
          type: record.comment.attachment.type,
          id: record.comment.attachment.id,
          label: record.comment.attachment.label,
          provider: record.comment.attachment.provider,
          url: record.comment.attachment.url,
          preview: record.comment.attachment.preview,
        }
      : undefined,
    replies: [],
  };
}

function tree(comments: CommentView[]): CommentView[] {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const roots: CommentView[] = [];
  for (const comment of comments) {
    const parent = comment.parentCommentId ? byId.get(comment.parentCommentId) : undefined;
    if (parent) parent.replies.push(comment);
    else roots.push(comment);
  }
  return roots;
}

export function createCommentService(dependencies: CommentServiceDependencies): CommentService {
  const now = dependencies.now ?? (() => Date.now());
  const policy = { profileStore: dependencies.profileStore, store: dependencies.postStore, now };

  async function requireVisiblePost(postId: string, viewerId: string | null) {
    const post = await dependencies.postStore.getPost(postId);
    if (!post || !(await canViewPost(viewerId, post.post, policy))) {
      throw new PostError(404, "POST_NOT_FOUND", "The post was not found.");
    }
    return post;
  }

  async function requireComment(commentId: string) {
    const comment = await dependencies.store.getComment(commentId);
    if (!comment) throw new PostError(404, "COMMENT_NOT_FOUND", "The comment was not found.");
    return comment;
  }

  return {
    async listForPost(postId, viewerId, cursor, limit) {
      await requireVisiblePost(postId, viewerId);
      const page = await dependencies.store.listForPost({
        postId,
        cursor: decodePostCursor(cursor) as CommentCursor | null,
        limit: Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT),
      });
      const likedIds = viewerId
        ? dependencies.store.getLikedCommentIds
          ? await dependencies.store.getLikedCommentIds(
              viewerId,
              page.comments.map((comment) => comment.comment.id),
            )
          : new Set(
              await Promise.all(
                page.comments.map(async (comment) =>
                  (await dependencies.store.hasLike(viewerId, "COMMENT", comment.comment.id))
                    ? comment.comment.id
                    : null,
                ),
              ).then((ids) => ids.filter((id): id is string => Boolean(id))),
            )
        : new Set<string>();
      const emoteShortcodes = [
        ...new Set(
          page.comments.flatMap((record) =>
            record.comment.richtext
              .filter((node) => node.type === "emote")
              .map((node) => normalizeEmoteShortcode(node.shortcode))
              .filter((shortcode): shortcode is string => Boolean(shortcode)),
          ),
        ),
      ];
      const emoteAssets = dependencies.store.getEmoteAssets
        ? await dependencies.store.getEmoteAssets(emoteShortcodes)
        : new Map<string, CommentEmoteAsset>();
      const views = await Promise.all(
        page.comments.map((comment) =>
          toView(
            comment,
            viewerId,
            dependencies.profileStore,
            now,
            likedIds.has(comment.comment.id),
            emoteAssets,
          ),
        ),
      );
      return { comments: tree(views), nextCursor: page.nextCursor };
    },

    async create(input) {
      const post = await requireVisiblePost(input.postId, input.authorId);
      if (
        post.post.status === "LOCKED" ||
        post.post.status === "ARCHIVED" ||
        post.post.commentsClosed
      ) {
        throw new PostError(409, "POST_NOT_COMMENTABLE", "This post is not accepting comments.");
      }
      if (input.parentCommentId) {
        const parent = await requireComment(input.parentCommentId);
        if (parent.comment.postId !== input.postId || parent.comment.state === "DELETED") {
          throw new PostError(400, "INVALID_COMMENT_PARENT", "The reply target is invalid.");
        }
      }
      const body = normalizeCommentBody(input);
      await dependencies.assertEntitlements?.(input.authorId, body);
      const createdAt = now();
      const record = {
        id: createIdentifier(),
        postId: input.postId,
        authorId: input.authorId,
        parentCommentId: input.parentCommentId ?? null,
        richtext: body.richtext,
        plaintext: body.plaintext,
        attachment: body.attachment,
        state: "VISIBLE" as const,
        likeCount: 0,
        createdAt,
        updatedAt: createdAt,
        editDeadlineAt: createdAt + EDIT_WINDOW_MS,
        deletedAt: null,
        hiddenAt: null,
      };
      await dependencies.store.createComment({
        comment: record,
        richtextJson: JSON.stringify(body.richtext),
        attachmentJson: body.attachment ? JSON.stringify(body.attachment) : null,
      });
      const createdEmoteAssets = dependencies.store.getEmoteAssets
        ? await dependencies.store.getEmoteAssets(
            body.richtext
              .filter((node) => node.type === "emote")
              .map((node) => normalizeEmoteShortcode(node.shortcode))
              .filter((shortcode): shortcode is string => Boolean(shortcode)),
          )
        : new Map<string, CommentEmoteAsset>();
      return toView(
        {
          comment: record,
          author: {
            userId: input.authorId,
            username: "SourceBoard member",
            displayName: "SourceBoard member",
            avatarAssetId: null,
          },
          post: {
            authorId: post.post.authorId,
            authorMode: post.post.authorMode,
            visibility: post.post.visibility,
            deletedAt: post.post.deletedAt,
            hiddenAt: post.post.hiddenAt,
            status: post.post.status,
          },
        },
        input.authorId,
        dependencies.profileStore,
        now,
        false,
        createdEmoteAssets,
      );
    },

    async update(commentId, authorId, input) {
      const current = await requireComment(commentId);
      if (current.comment.authorId !== authorId) {
        throw new PostError(403, "COMMENT_EDIT_FORBIDDEN", "You cannot edit this comment.");
      }
      const currentTime = now();
      if (current.comment.editDeadlineAt < currentTime || current.comment.state !== "VISIBLE") {
        throw new PostError(
          409,
          "COMMENT_EDIT_WINDOW_CLOSED",
          "The 24-hour edit window has closed.",
        );
      }
      const body = normalizeCommentBody(input);
      await dependencies.assertEntitlements?.(authorId, body);
      const updated = {
        ...current.comment,
        richtext: body.richtext,
        plaintext: body.plaintext,
        attachment: body.attachment,
        updatedAt: currentTime,
      };
      if (
        !(await dependencies.store.updateComment({
          comment: updated,
          richtextJson: JSON.stringify(body.richtext),
          attachmentJson: body.attachment ? JSON.stringify(body.attachment) : null,
          revisionId: createIdentifier(),
        }))
      ) {
        throw new PostError(
          409,
          "COMMENT_EDIT_CONFLICT",
          "The comment changed before it could be saved.",
        );
      }
      const updatedEmoteAssets = dependencies.store.getEmoteAssets
        ? await dependencies.store.getEmoteAssets(
            body.richtext
              .filter((node) => node.type === "emote")
              .map((node) => normalizeEmoteShortcode(node.shortcode))
              .filter((shortcode): shortcode is string => Boolean(shortcode)),
          )
        : new Map<string, CommentEmoteAsset>();
      return toView(
        { ...current, comment: updated },
        authorId,
        dependencies.profileStore,
        now,
        false,
        updatedEmoteAssets,
      );
    },

    async delete(commentId, authorId) {
      if (!(await dependencies.store.deleteComment(commentId, authorId, now()))) {
        throw new PostError(403, "COMMENT_DELETE_FORBIDDEN", "The comment could not be deleted.");
      }
    },

    async toggleLike(targetType, targetId, userId) {
      if (targetType === "POST") await requireVisiblePost(targetId, userId);
      else {
        const comment = await requireComment(targetId);
        await requireVisiblePost(comment.comment.postId, userId);
        if (comment.comment.state !== "VISIBLE")
          throw new PostError(404, "COMMENT_NOT_FOUND", "The comment was not found.");
      }
      return dependencies.store.toggleLike({ userId, targetType, targetId, now: now() });
    },

    async setLike(targetType, targetId, userId, liked) {
      if (targetType === "POST") await requireVisiblePost(targetId, userId);
      else {
        const comment = await requireComment(targetId);
        await requireVisiblePost(comment.comment.postId, userId);
        if (comment.comment.state !== "VISIBLE") {
          throw new PostError(404, "COMMENT_NOT_FOUND", "The comment was not found.");
        }
      }
      return dependencies.store.setLike({ userId, targetType, targetId, liked, now: now() });
    },
  };
}
