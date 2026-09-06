import { canViewNsfwPost, canViewUser } from "../privacy/policy";
import type { ProfileStore } from "../profile/store";
import { createIdentifier } from "../auth/crypto";
import { PostError } from "./errors";
import { decodePostCursor } from "./pagination";
import type { PostStore } from "./store";
import type {
  FeedKind,
  PostAuthorMode,
  PostCreateInput,
  PostRecord,
  PostUpdateInput,
  PostVisibility,
  PostWithAuthor,
} from "./types";
import type { PostDetail, PostSummary, PublicPostAuthor } from "../../shared/ui/contracts";

const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 10_000;
const MAX_FEED_LIMIT = 30;
const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface PostServiceDependencies {
  store: PostStore;
  profileStore: ProfileStore;
  now?: () => number;
}

export interface CreatePostServiceInput extends Omit<
  PostCreateInput,
  "slug" | "createdAt" | "editDeadlineAt"
> {
  now?: number;
}

export interface PostService {
  createPost(input: CreatePostServiceInput): Promise<PostDetail>;
  getPost(postId: string, viewerId: string | null): Promise<PostDetail | null>;
  listFeed(input: {
    viewerId: string | null;
    kind: FeedKind;
    cursor: string | null;
    limit: number;
  }): Promise<{ posts: PostSummary[]; nextCursor: string | null }>;
  updatePost(
    postId: string,
    editorUserId: string,
    input: Omit<PostUpdateInput, "slug">,
  ): Promise<PostDetail>;
  setNsfw(
    postId: string,
    editorUserId: string,
    isNsfw: boolean,
    options?: { allowModeration?: boolean },
  ): Promise<PostDetail>;
  archivePost(postId: string, authorId: string, archived: boolean): Promise<void>;
  deletePost(postId: string, authorId: string): Promise<void>;
  getVisibleMedia(
    assetId: string,
    viewerId: string | null,
  ): Promise<{ post: PostWithAuthor; media: PostWithAuthor["media"] } | null>;
  getAnonymousAuthorForAdmin(postId: string): Promise<{ userId: string; username: string }>;
}

function validatePostFields(input: {
  title: string;
  description: string;
  visibility: PostVisibility;
  authorMode: PostAuthorMode;
}): { title: string; description: string } {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title || title.length > MAX_TITLE_LENGTH) {
    throw new PostError(
      400,
      "INVALID_POST_TITLE",
      "A title shorter than 160 characters is required.",
    );
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new PostError(400, "INVALID_POST_DESCRIPTION", "The description is too long.");
  }
  if (!isPostVisibility(input.visibility)) {
    throw new PostError(400, "INVALID_POST_VISIBILITY", "The post visibility is invalid.");
  }
  if (!isPostAuthorMode(input.authorMode)) {
    throw new PostError(400, "INVALID_AUTHOR_MODE", "The post author mode is invalid.");
  }
  if (input.authorMode === "ANONYMOUS" && input.visibility === "FRIENDS_ONLY") {
    throw new PostError(
      400,
      "ANONYMOUS_FRIENDS_ONLY_UNSUPPORTED",
      "Anonymous posts cannot be limited to friends.",
    );
  }
  return { title, description };
}

function isPostVisibility(value: string): value is PostVisibility {
  return ["PUBLIC", "FRIENDS_ONLY", "UNLISTED", "PRIVATE"].includes(value);
}

function isPostAuthorMode(value: string): value is PostAuthorMode {
  return value === "IDENTIFIED" || value === "ANONYMOUS";
}

export function createPostSlug(title: string, postId: string): string {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || `source-request-${postId.slice(0, 12)}`;
}

export async function canViewPost(
  viewerId: string | null,
  post: PostRecord,
  dependencies: { profileStore: ProfileStore; store: PostStore; now: () => number },
): Promise<boolean> {
  if (post.deletedAt || post.hiddenAt) return false;
  if (post.status === "ARCHIVED" && viewerId !== post.authorId) return false;

  if (viewerId && viewerId !== post.authorId) {
    const [blockedByViewer, blockingViewer] = await Promise.all([
      dependencies.profileStore.getBlock(viewerId, post.authorId),
      dependencies.profileStore.getBlock(post.authorId, viewerId),
    ]);
    if (blockedByViewer || blockingViewer) return false;
  }

  if (post.visibility === "PRIVATE" && viewerId !== post.authorId) return false;
  if (post.visibility === "FRIENDS_ONLY" && viewerId !== post.authorId) {
    if (
      !viewerId ||
      (await dependencies.profileStore.getRelationship(viewerId, post.authorId)) !== "FRIEND"
    ) {
      return false;
    }
  }

  return canViewNsfwPost(viewerId, post.id, {
    readPost: async () => ({ id: post.id, authorUserId: post.authorId, isNsfw: post.isNsfw }),
    readPreferences: async (userId) => {
      const preferences = await dependencies.profileStore.getPreferences(
        userId,
        dependencies.now(),
      );
      return {
        hideNsfw: preferences.hideNsfw,
        allowNsfwDirectOverride: preferences.allowNsfwDirectOverride,
      };
    },
  });
}

function authorForPost(post: PostWithAuthor, profileVisible: boolean): PublicPostAuthor {
  if (post.post.authorMode === "ANONYMOUS") {
    return { mode: "ANONYMOUS", displayName: "Anonymous Author" };
  }
  if (!profileVisible) {
    return { mode: "IDENTIFIED", displayName: "SourceBoard member" };
  }
  return {
    mode: "IDENTIFIED",
    displayName: post.author.displayName,
    username: post.author.username,
    avatarUrl: post.author.avatarAssetId
      ? `/api/media/profile/${encodeURIComponent(post.author.avatarAssetId)}`
      : undefined,
    profileUrl: `/u/${encodeURIComponent(post.author.username)}`,
  };
}

async function toPostSummary(
  post: PostWithAuthor,
  viewerId: string | null,
  dependencies: { profileStore: ProfileStore; store: PostStore; now: () => number },
): Promise<PostSummary> {
  const profileVisible =
    post.post.authorMode === "IDENTIFIED"
      ? await canViewUser(viewerId, post.post.authorId, {
          store: dependencies.profileStore,
          now: dependencies.now,
        })
      : false;
  const nsfwVisible = await canViewPost(viewerId, post.post, dependencies);
  const nsfwPresentation = !post.post.isNsfw
    ? "VISIBLE"
    : !nsfwVisible
      ? "HIDDEN"
      : (
            await dependencies.profileStore
              .getPreferences(viewerId ?? "", dependencies.now())
              .catch(() => null)
          )?.blurNsfw
        ? "BLURRED"
        : "VISIBLE";
  const isMediaVisible = nsfwPresentation !== "HIDDEN" && post.media.status === "ACTIVE";
  return {
    id: post.post.id,
    slug: post.post.slug,
    title: post.post.title,
    description: post.post.description || undefined,
    author: authorForPost(post, profileVisible),
    createdAt: new Date(post.post.createdAt).toISOString(),
    status: post.post.status,
    visibility: post.post.visibility,
    isNsfw: post.post.isNsfw,
    nsfwPresentation,
    reaction: { type: "LIKE", count: post.post.likeCount, viewerReacted: false },
    commentCount: post.post.commentCount,
    imageAlt: post.post.title,
    imageUrl: isMediaVisible ? `/api/media/post/${encodeURIComponent(post.media.id)}` : undefined,
    imageWidth: post.media.width ?? undefined,
    imageHeight: post.media.height ?? undefined,
  };
}

async function toPostDetail(
  post: PostWithAuthor,
  viewerId: string | null,
  dependencies: { profileStore: ProfileStore; store: PostStore; now: () => number },
): Promise<PostDetail> {
  const summary = await toPostSummary(post, viewerId, dependencies);
  const isOwner = viewerId === post.post.authorId;
  const canEdit =
    isOwner && post.post.editDeadlineAt >= dependencies.now() && post.post.status !== "LOCKED";
  return {
    ...summary,
    comments: [],
    permissions: {
      canEdit,
      canArchive: isOwner && !post.post.deletedAt,
      canDelete: isOwner && !post.post.deletedAt,
      canAcceptSource: false,
      canModerate: false,
      canVerifySource: false,
      canRevealAnonymous: false,
      canMarkNsfw: isOwner && !post.post.deletedAt,
    },
  };
}

export function createPostService(dependencies: PostServiceDependencies): PostService {
  const now = dependencies.now ?? (() => Date.now());
  const policyDependencies = {
    profileStore: dependencies.profileStore,
    store: dependencies.store,
    now,
  };

  async function requirePost(postId: string): Promise<PostWithAuthor> {
    const post = await dependencies.store.getPost(postId);
    if (!post) throw new PostError(404, "POST_NOT_FOUND", "The post was not found.");
    return post;
  }

  return {
    async createPost(input) {
      const validated = validatePostFields(input);
      const createdAt = input.now ?? now();
      const slug = createPostSlug(validated.title, input.id);
      await dependencies.store.createPost({
        ...input,
        ...validated,
        slug,
        createdAt,
        editDeadlineAt: createdAt + EDIT_WINDOW_MS,
      });
      const created = await requirePost(input.id);
      return toPostDetail(created, input.authorId, policyDependencies);
    },

    async getPost(postId, viewerId) {
      const post = await dependencies.store.getPost(postId);
      if (!post || !(await canViewPost(viewerId, post.post, policyDependencies))) return null;
      return toPostDetail(post, viewerId, policyDependencies);
    },

    async listFeed({ viewerId, kind, cursor, limit }) {
      const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_FEED_LIMIT);
      let decodedCursor = decodePostCursor(cursor);
      const visible: PostSummary[] = [];
      let nextCursor: string | null = null;
      for (let page = 0; page < 5 && visible.length < safeLimit; page += 1) {
        const result = await dependencies.store.listFeed({
          viewerId,
          kind,
          cursor: decodedCursor,
          limit: safeLimit * 2,
        });
        for (const post of result.posts) {
          if (await canViewPost(viewerId, post.post, policyDependencies)) {
            visible.push(await toPostSummary(post, viewerId, policyDependencies));
            if (visible.length >= safeLimit) break;
          }
        }
        nextCursor = result.nextCursor;
        if (!result.nextCursor) break;
        decodedCursor = decodePostCursor(result.nextCursor);
      }
      return { posts: visible, nextCursor };
    },

    async updatePost(postId, editorUserId, input) {
      const current = await requirePost(postId);
      if (current.post.authorId !== editorUserId) {
        throw new PostError(403, "POST_EDIT_FORBIDDEN", "You cannot edit this post.");
      }
      if (current.post.deletedAt || current.post.status === "LOCKED") {
        throw new PostError(409, "POST_NOT_EDITABLE", "This post cannot be edited.");
      }
      const validated = validatePostFields(input);
      const currentTime = now();
      if (current.post.editDeadlineAt < currentTime) {
        throw new PostError(
          409,
          "POST_EDIT_WINDOW_CLOSED",
          "The seven-day edit window has closed.",
        );
      }
      const next: PostUpdateInput = {
        ...input,
        ...validated,
        slug: createPostSlug(validated.title, postId),
      };
      const updated = await dependencies.store.updatePost({
        postId,
        editorUserId,
        revisionId: createIdentifier(),
        next,
        previous: {
          id: `${postId}-previous`,
          postId,
          title: current.post.title,
          description: current.post.description,
          visibility: current.post.visibility,
          authorMode: current.post.authorMode,
          isNsfw: current.post.isNsfw,
          editorUserId,
          reason: input.reason,
          createdAt: currentTime,
        },
        now: currentTime,
      });
      if (!updated)
        throw new PostError(
          409,
          "POST_EDIT_CONFLICT",
          "The post changed before it could be saved.",
        );
      const nextPost = await requirePost(postId);
      return toPostDetail(nextPost, editorUserId, policyDependencies);
    },

    async setNsfw(postId, editorUserId, isNsfw, options = {}) {
      const current = await requirePost(postId);
      const isOwner = current.post.authorId === editorUserId;
      const isAuthorOwnedNsfwMark =
        !current.post.isNsfw || current.post.nsfwMarkedBy === editorUserId;
      if ((!isOwner || !isAuthorOwnedNsfwMark) && !options.allowModeration) {
        throw new PostError(
          403,
          "POST_NSFW_FORBIDDEN",
          "You cannot change this post's NSFW state.",
        );
      }
      if (current.post.deletedAt || current.post.status === "LOCKED") {
        throw new PostError(409, "POST_NOT_EDITABLE", "This post cannot be edited.");
      }
      const currentTime = now();
      const updated = await dependencies.store.updatePost({
        postId,
        editorUserId,
        revisionId: createIdentifier(),
        next: {
          title: current.post.title,
          slug: current.post.slug,
          description: current.post.description,
          visibility: current.post.visibility,
          authorMode: current.post.authorMode,
          isNsfw,
          reason: "NSFW preference update",
        },
        previous: {
          id: `${postId}-previous-nsfw`,
          postId,
          title: current.post.title,
          description: current.post.description,
          visibility: current.post.visibility,
          authorMode: current.post.authorMode,
          isNsfw: current.post.isNsfw,
          editorUserId,
          reason: "NSFW preference update",
          createdAt: currentTime,
        },
        now: currentTime,
        allowNonOwner: !isOwner,
      });
      if (!updated)
        throw new PostError(
          409,
          "POST_EDIT_WINDOW_CLOSED",
          "The seven-day edit window has closed.",
        );
      return toPostDetail(
        await requirePost(postId),
        isOwner ? editorUserId : null,
        policyDependencies,
      );
    },

    async archivePost(postId, authorId, archived) {
      if (!(await dependencies.store.archivePost(postId, authorId, now(), archived))) {
        throw new PostError(403, "POST_ARCHIVE_FORBIDDEN", "The post could not be archived.");
      }
    },

    async deletePost(postId, authorId) {
      if (!(await dependencies.store.deletePost(postId, authorId, now()))) {
        throw new PostError(403, "POST_DELETE_FORBIDDEN", "The post could not be deleted.");
      }
    },

    async getVisibleMedia(assetId, viewerId) {
      const post = await dependencies.store.getPostForMedia(assetId);
      if (!post || post.media.status !== "ACTIVE") return null;
      if (!(await canViewPost(viewerId, post.post, policyDependencies))) return null;
      return { post, media: post.media };
    },

    async getAnonymousAuthorForAdmin(postId) {
      const post = await requirePost(postId);
      if (post.post.authorMode !== "ANONYMOUS") {
        throw new PostError(
          409,
          "POST_NOT_ANONYMOUS",
          "This post does not use anonymous authorship.",
        );
      }
      return { userId: post.author.userId, username: post.author.username };
    },
  };
}
