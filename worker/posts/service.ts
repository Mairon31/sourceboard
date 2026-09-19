import type { PostCategorySlug } from "../../shared/posts/categories";
import {
  normalizeEmoteShortcode,
  parseMarkdown,
  type SafeInlineRichTextNode,
  type SafeRichTextNode,
} from "../../shared/richtext/markdown";
import type { PostDetail, PostSummary, PublicPostAuthor } from "../../shared/ui/contracts";
import { createIdentifier } from "../auth/crypto";
import { canViewNsfwPost, canViewUser } from "../privacy/policy";
import type { ProfileStore } from "../profile/store";
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

const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 10_000;
const MAX_FEED_LIMIT = 30;
const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const SOFT_DELETE_RETENTION_MS = 24 * 60 * 60 * 1000;

type PostEmoteAsset = {
  id: string;
  label: string;
  shortcode: string;
  url: string;
};

function createRequestProfileStore(store: ProfileStore): ProfileStore {
  const profileByUserId = new Map<string, ReturnType<ProfileStore["getProfileByUserId"]>>();
  const preferences = new Map<string, ReturnType<ProfileStore["getPreferences"]>>();
  const cosmetics = new Map<string, ReturnType<ProfileStore["getEquippedCosmetics"]>>();
  const blocks = new Map<string, ReturnType<ProfileStore["getBlock"]>>();

  const scoped = {
    ...store,
    getProfileByUserId(userId, now) {
      let result = profileByUserId.get(userId);
      if (!result) {
        result = store.getProfileByUserId(userId, now);
        profileByUserId.set(userId, result);
      }
      return result;
    },
    getPreferences(userId, now) {
      let result = preferences.get(userId);
      if (!result) {
        result = store.getPreferences(userId, now);
        preferences.set(userId, result);
      }
      return result;
    },
    getBlock(blockerId, blockedId) {
      const key = `${blockerId}\u0000${blockedId}`;
      let result = blocks.get(key);
      if (!result) {
        result = store.getBlock(blockerId, blockedId);
        blocks.set(key, result);
      }
      return result;
    },
  } as ProfileStore;
  if (typeof store.getEquippedCosmetics === "function") {
    scoped.getEquippedCosmetics = (userId) => {
      let result = cosmetics.get(userId);
      if (!result) {
        result = store.getEquippedCosmetics(userId);
        cosmetics.set(userId, result);
      }
      return result;
    };
  }
  return scoped;
}

export interface PostServiceDependencies {
  store: PostStore;
  profileStore: ProfileStore;
  assertEmoteEntitlements?: (userId: string, nodes: readonly unknown[]) => Promise<void>;
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
    categorySlug?: PostCategorySlug | null;
    cursor: string | null;
    limit: number;
  }): Promise<{ posts: PostSummary[]; nextCursor: string | null }>;
  listProfileActivity(input: {
    authorId: string;
    viewerId: string | null;
    limit: number;
  }): Promise<{ posts: PostSummary[]; acceptedSources: PostSummary[] }>;
  listRecentlyDeleted(authorId: string, limit: number): Promise<PostSummary[]>;
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
  setCommentsClosed(postId: string, authorId: string, closed: boolean): Promise<PostDetail>;
  deletePost(postId: string, authorId: string): Promise<void>;
  restorePost(postId: string, authorId: string): Promise<void>;
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
  if (description) {
    try {
      parseMarkdown(description);
    } catch {
      throw new PostError(
        400,
        "INVALID_POST_DESCRIPTION",
        "The description contains unsupported Markdown.",
      );
    }
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

export function isPublicAnonymousNsfwPreview(
  viewerId: string | null,
  post: {
    visibility: string;
    isNsfw: boolean;
    deletedAt?: number | string | null;
    hiddenAt?: number | string | null;
  },
): boolean {
  return (
    !viewerId && post.visibility === "PUBLIC" && post.isNsfw && !post.deletedAt && !post.hiddenAt
  );
}

async function canListPostOnProfile(
  viewerId: string | null,
  post: PostRecord,
  dependencies: { profileStore: ProfileStore; store: PostStore; now: () => number },
): Promise<boolean> {
  const isOwner = viewerId === post.authorId;
  if (!isOwner && (post.authorMode === "ANONYMOUS" || post.visibility === "UNLISTED")) {
    return false;
  }
  return (
    isPublicAnonymousNsfwPreview(viewerId, post) ||
    (await canViewPost(viewerId, post, dependencies))
  );
}

async function canListAcceptedSourceOnProfile(
  profileOwnerId: string,
  viewerId: string | null,
  post: PostRecord,
  dependencies: { profileStore: ProfileStore; store: PostStore; now: () => number },
): Promise<boolean> {
  if (viewerId !== profileOwnerId && post.visibility === "UNLISTED") return false;
  return (
    isPublicAnonymousNsfwPreview(viewerId, post) ||
    (await canViewPost(viewerId, post, dependencies))
  );
}

function hydratePostInline(
  nodes: SafeInlineRichTextNode[],
  assets: Map<string, PostEmoteAsset>,
): SafeInlineRichTextNode[] {
  return nodes.map((node) => {
    if (node.type !== "emote") return node;
    const shortcode = normalizeEmoteShortcode(node.shortcode);
    const asset = shortcode ? assets.get(shortcode) : undefined;
    return asset ? { ...node, id: asset.id, label: asset.label, url: asset.url } : node;
  });
}

function hydratePostRichtext(
  nodes: SafeRichTextNode[],
  assets: Map<string, PostEmoteAsset>,
): SafeRichTextNode[] {
  return nodes.map((node) => {
    if (node.type === "paragraph" || node.type === "heading") {
      return { ...node, children: hydratePostInline(node.children, assets) };
    }
    if (node.type === "quote") {
      return { ...node, children: hydratePostRichtext(node.children, assets) };
    }
    if (node.type === "list") {
      return {
        ...node,
        items: node.items.map((item) => ({
          ...item,
          children: hydratePostInline(item.children, assets),
        })),
      };
    }
    return node;
  });
}

function parsePostRichtext(
  description: string,
  assets: Map<string, PostEmoteAsset>,
): SafeRichTextNode[] | undefined {
  try {
    return hydratePostRichtext(parseMarkdown(description), assets);
  } catch {
    // Legacy records may predate the canonical parser. Preserve the raw text
    // fallback in the UI instead of making a feed unavailable.
    return undefined;
  }
}

function collectPostEmoteShortcodes(nodes: SafeRichTextNode[], output: Set<string>): void {
  for (const node of nodes) {
    if (node.type === "paragraph" || node.type === "heading") {
      for (const child of node.children) {
        if (child.type === "emote") {
          const shortcode = normalizeEmoteShortcode(child.shortcode);
          if (shortcode) output.add(shortcode);
        }
      }
    } else if (node.type === "quote") {
      collectPostEmoteShortcodes(node.children, output);
    } else if (node.type === "list") {
      for (const item of node.items) {
        for (const child of item.children) {
          if (child.type === "emote") {
            const shortcode = normalizeEmoteShortcode(child.shortcode);
            if (shortcode) output.add(shortcode);
          }
        }
      }
    }
  }
}

async function getPostEmoteAssets(
  posts: PostWithAuthor[],
  viewerId: string | null,
  profileStore: ProfileStore,
): Promise<Map<string, PostEmoteAsset>> {
  if (!profileStore.getEmoteAssets) return new Map();
  const shortcodes = new Set<string>();
  for (const post of posts) {
    const nodes = parsePostRichtext(post.post.description, new Map());
    if (nodes) collectPostEmoteShortcodes(nodes, shortcodes);
  }
  if (!shortcodes.size) return new Map();
  try {
    return await profileStore.getEmoteAssets([...shortcodes], viewerId);
  } catch {
    // Emote hydration is optional presentation data; the safe shortcode
    // remains renderable if the catalog is temporarily unavailable.
    return new Map();
  }
}

function authorForPost(
  post: PostWithAuthor,
  profileVisible: boolean,
  cosmetics?: Awaited<ReturnType<ProfileStore["getEquippedCosmetics"]>>,
): PublicPostAuthor {
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
    avatarFrame: cosmetics?.avatarFrame,
    profileEffect: cosmetics?.profileEffect,
    nameFont: cosmetics?.nameFont,
    nameEffect: cosmetics?.nameEffect,
    visuals: cosmetics?.visuals,
  };
}

async function toPostSummary(
  post: PostWithAuthor,
  viewerId: string | null,
  dependencies: { profileStore: ProfileStore; store: PostStore; now: () => number },
  allowDeletedOwner = false,
  emoteAssets: Map<string, PostEmoteAsset> = new Map(),
): Promise<PostSummary> {
  const profileVisible =
    post.post.authorMode === "IDENTIFIED"
      ? await canViewUser(viewerId, post.post.authorId, {
          store: dependencies.profileStore,
          now: dependencies.now,
        })
      : false;
  const cosmetics = profileVisible
    ? await dependencies.profileStore.getEquippedCosmetics?.(post.post.authorId)
    : undefined;
  const nsfwVisible = allowDeletedOwner
    ? true
    : await canViewPost(viewerId, post.post, dependencies);
  const publicAnonymousPreview = isPublicAnonymousNsfwPreview(viewerId, post.post);
  const blurNsfw = viewerId
    ? Boolean(
        (
          await dependencies.profileStore
            .getPreferences(viewerId, dependencies.now())
            .catch(() => null)
        )?.blurNsfw,
      )
    : true;
  const nsfwPresentation = !post.post.isNsfw
    ? "VISIBLE"
    : !nsfwVisible && !publicAnonymousPreview
      ? "HIDDEN"
      : blurNsfw
        ? "BLURRED"
        : "VISIBLE";
  const isMediaVisible = post.media.status === "ACTIVE";
  const descriptionRichtext = post.post.description
    ? parsePostRichtext(post.post.description, emoteAssets)
    : undefined;
  return {
    id: post.post.id,
    slug: post.post.slug,
    title: post.post.title,
    description: post.post.description || undefined,
    ...(descriptionRichtext ? { descriptionRichtext } : {}),
    categorySlug: post.post.categorySlug,
    author: authorForPost(post, profileVisible, cosmetics),
    createdAt: new Date(post.post.createdAt).toISOString(),
    updatedAt: new Date(post.post.updatedAt).toISOString(),
    status: post.post.status,
    visibility: post.post.visibility,
    isNsfw: post.post.isNsfw,
    nsfwPresentation,
    reaction: {
      type: "LIKE",
      count: post.post.hideLikeCount ? 0 : post.post.likeCount,
      viewerReacted: false,
    },
    commentCount: post.post.commentCount,
    commentsClosed: post.post.commentsClosed,
    likeCountHidden: post.post.hideLikeCount,
    imageAlt: post.post.title,
    imageUrl: isMediaVisible ? `/api/media/post/${encodeURIComponent(post.media.id)}` : undefined,
    imageWidth: post.media.width ?? undefined,
    imageHeight: post.media.height ?? undefined,
    ...(allowDeletedOwner && post.post.deletedAt
      ? {
          deletedAt: new Date(post.post.deletedAt).toISOString(),
          restoreAvailable: true,
        }
      : {}),
    permissions: {
      canModerate: false,
      canReport: Boolean(viewerId && viewerId !== post.post.authorId && !post.post.deletedAt),
    },
    acceptedSource: post.acceptedSource
      ? {
          commentId: post.acceptedSource.commentId,
          canonicalUrl: post.acceptedSource.canonicalUrl ?? undefined,
          acceptedAt: new Date(post.acceptedSource.acceptedAt).toISOString(),
          label: "Accepted Source",
        }
      : undefined,
    verifiedSource: post.verifiedSource
      ? {
          commentId: post.verifiedSource.commentId,
          canonicalUrl: post.verifiedSource.canonicalUrl,
          ...(post.verifiedSource.evidenceSummary
            ? { evidenceSummary: post.verifiedSource.evidenceSummary }
            : {}),
          verifiedAt: new Date(post.verifiedSource.verifiedAt).toISOString(),
          verifierLabel: post.verifiedSource.verifierLabel,
          label: "Verified Source",
        }
      : undefined,
  };
}

async function toPostDetail(
  post: PostWithAuthor,
  viewerId: string | null,
  dependencies: { profileStore: ProfileStore; store: PostStore; now: () => number },
  allowDeletedOwner = false,
  emoteAssets?: Map<string, PostEmoteAsset>,
): Promise<PostDetail> {
  const summary = await toPostSummary(
    post,
    viewerId,
    dependencies,
    allowDeletedOwner,
    emoteAssets ?? (await getPostEmoteAssets([post], viewerId, dependencies.profileStore)),
  );
  const isOwner = viewerId === post.post.authorId;
  const canEdit =
    isOwner &&
    !post.post.deletedAt &&
    post.post.editDeadlineAt >= dependencies.now() &&
    post.post.status !== "LOCKED";
  return {
    ...summary,
    comments: [],
    permissions: {
      canEdit,
      canArchive: isOwner && !post.post.deletedAt,
      canDelete: isOwner && !post.post.deletedAt,
      canRestore: allowDeletedOwner,
      canAcceptSource: isOwner && !post.post.deletedAt && post.post.status !== "LOCKED",
      canModerate: false,
      canReport: Boolean(viewerId) && !isOwner && !post.post.deletedAt,
      canVerifySource: false,
      canRevealAnonymous: false,
      canMarkNsfw: isOwner && !post.post.deletedAt,
      canCloseComments:
        isOwner &&
        !post.post.deletedAt &&
        Boolean(post.post.acceptedCommentId) &&
        !post.post.commentsClosed,
      canReopenComments: isOwner && !post.post.deletedAt && post.post.commentsClosed,
      canModerateDelete: false,
      canModerateArchive: false,
      canModerateCategory: false,
      canModerateComments: false,
      canModerateLikes: false,
      canModerateMarkNsfw: false,
      canModerateUnmarkNsfw: false,
      canModerateTimeout: false,
      canModerateHide: false,
      canModerateRestore: false,
      canModerateLock: false,
      canModerateSource: false,
    },
  };
}

export function createPostService(dependencies: PostServiceDependencies): PostService {
  const now = dependencies.now ?? (() => Date.now());
  const profileStore = createRequestProfileStore(dependencies.profileStore);
  const policyDependencies = {
    profileStore,
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
      await dependencies.assertEmoteEntitlements?.(
        input.authorId,
        parseMarkdown(validated.description),
      );
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
      if (!post) return null;
      const restoreAvailable = Boolean(
        viewerId === post.post.authorId &&
        post.post.deletedAt &&
        now() - post.post.deletedAt < SOFT_DELETE_RETENTION_MS,
      );
      const publicAnonymousPreview = isPublicAnonymousNsfwPreview(viewerId, post.post);
      if (
        !restoreAvailable &&
        !publicAnonymousPreview &&
        !(await canViewPost(viewerId, post.post, policyDependencies))
      ) {
        return null;
      }
      return toPostDetail(post, viewerId, policyDependencies, restoreAvailable);
    },

    async listFeed({ viewerId, kind, categorySlug, cursor, limit }) {
      const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_FEED_LIMIT);
      let decodedCursor = decodePostCursor(cursor);
      const visible: PostWithAuthor[] = [];
      let nextCursor: string | null = null;
      for (let page = 0; page < 5 && visible.length < safeLimit; page += 1) {
        const result = await dependencies.store.listFeed({
          viewerId,
          kind,
          categorySlug,
          cursor: decodedCursor,
          limit: safeLimit * 2,
        });
        for (const post of result.posts) {
          if (
            isPublicAnonymousNsfwPreview(viewerId, post.post) ||
            (await canViewPost(viewerId, post.post, policyDependencies))
          ) {
            visible.push(post);
            if (visible.length >= safeLimit) break;
          }
        }
        nextCursor = result.nextCursor;
        if (!result.nextCursor) break;
        decodedCursor = decodePostCursor(result.nextCursor);
      }
      const emoteAssets = await getPostEmoteAssets(visible, viewerId, dependencies.profileStore);
      return {
        posts: await Promise.all(
          visible.map((post) =>
            toPostSummary(post, viewerId, policyDependencies, false, emoteAssets),
          ),
        ),
        nextCursor,
      };
    },

    async listProfileActivity({ authorId, viewerId, limit }) {
      const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_FEED_LIMIT);
      const [visible, acceptedSources] = await Promise.all([
        (async () => {
          let decodedCursor = decodePostCursor(null);
          const posts: PostWithAuthor[] = [];
          for (let page = 0; page < 5 && posts.length < safeLimit; page += 1) {
            const result = await dependencies.store.listByAuthor({
              authorId,
              cursor: decodedCursor,
              limit: safeLimit * 2,
            });
            for (const post of result.posts) {
              if (await canListPostOnProfile(viewerId, post.post, policyDependencies)) {
                posts.push(post);
                if (posts.length >= safeLimit) break;
              }
            }
            if (!result.nextCursor) break;
            decodedCursor = decodePostCursor(result.nextCursor);
          }
          return posts;
        })(),
        (async () => {
          let acceptedCursor = decodePostCursor(null);
          const posts: PostWithAuthor[] = [];
          for (let page = 0; page < 5 && posts.length < safeLimit; page += 1) {
            const result = await dependencies.store.listAcceptedByContributor({
              contributorId: authorId,
              cursor: acceptedCursor,
              limit: safeLimit * 2,
            });
            for (const post of result.posts) {
              if (
                await canListAcceptedSourceOnProfile(
                  authorId,
                  viewerId,
                  post.post,
                  policyDependencies,
                )
              ) {
                posts.push(post);
                if (posts.length >= safeLimit) break;
              }
            }
            if (!result.nextCursor) break;
            acceptedCursor = decodePostCursor(result.nextCursor);
          }
          return posts;
        })(),
      ]);

      const emoteAssets = await getPostEmoteAssets(
        [...visible, ...acceptedSources],
        viewerId,
        dependencies.profileStore,
      );
      const [posts, acceptedSourceSummaries] = await Promise.all([
        Promise.all(
          visible.map((post) =>
            toPostSummary(post, viewerId, policyDependencies, false, emoteAssets),
          ),
        ),
        Promise.all(
          acceptedSources.map((post) =>
            toPostSummary(post, viewerId, policyDependencies, false, emoteAssets),
          ),
        ),
      ]);
      return { posts, acceptedSources: acceptedSourceSummaries };
    },

    async listRecentlyDeleted(authorId, limit) {
      const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_FEED_LIMIT);
      const deleted = await dependencies.store.listDeletedByAuthor({
        authorId,
        cutoff: now() - SOFT_DELETE_RETENTION_MS,
        limit: safeLimit,
      });
      const visibleDeleted = deleted.filter(
        (post) =>
          post.post.authorId === authorId &&
          Boolean(post.post.deletedAt) &&
          now() - (post.post.deletedAt ?? 0) < SOFT_DELETE_RETENTION_MS,
      );
      const emoteAssets = await getPostEmoteAssets(
        visibleDeleted,
        authorId,
        dependencies.profileStore,
      );
      return Promise.all(
        visibleDeleted.map((post) =>
          toPostSummary(post, authorId, policyDependencies, true, emoteAssets),
        ),
      );
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
      await dependencies.assertEmoteEntitlements?.(
        editorUserId,
        parseMarkdown(validated.description),
      );
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

    async setCommentsClosed(postId, authorId, closed) {
      const current = await requirePost(postId);
      if (current.post.authorId !== authorId || current.post.deletedAt) {
        throw new PostError(403, "POST_COMMENTS_FORBIDDEN", "You cannot change this discussion.");
      }
      if (closed && !current.post.acceptedCommentId) {
        throw new PostError(
          409,
          "POST_SOURCE_REQUIRED",
          "Accept a source before closing comments.",
        );
      }
      if (!(await dependencies.store.setCommentsClosed(postId, authorId, now(), closed))) {
        throw new PostError(
          409,
          "POST_COMMENTS_STATE_CHANGED",
          "The discussion changed. Refresh and try again.",
        );
      }
      return toPostDetail(await requirePost(postId), authorId, policyDependencies);
    },

    async deletePost(postId, authorId) {
      if (!(await dependencies.store.deletePost(postId, authorId, now()))) {
        throw new PostError(403, "POST_DELETE_FORBIDDEN", "The post could not be deleted.");
      }
    },

    async restorePost(postId, authorId) {
      const current = await requirePost(postId);
      const deletedAt = current.post.deletedAt;
      const restoredAt = now();
      if (
        current.post.authorId !== authorId ||
        !deletedAt ||
        restoredAt - deletedAt >= SOFT_DELETE_RETENTION_MS
      ) {
        throw new PostError(
          409,
          "POST_RESTORE_UNAVAILABLE",
          "This post can no longer be restored.",
        );
      }
      if (!(await dependencies.store.restorePost(postId, authorId, deletedAt, restoredAt))) {
        throw new PostError(
          409,
          "POST_RESTORE_STATE_CHANGED",
          "This post changed before it could be restored. Refresh and try again.",
        );
      }
    },

    async getVisibleMedia(assetId, viewerId) {
      const post = await dependencies.store.getPostForMedia(assetId);
      if (!post || post.media.status !== "ACTIVE") return null;
      const ownerCanRestore = Boolean(
        viewerId === post.post.authorId &&
        post.post.deletedAt &&
        now() - post.post.deletedAt < SOFT_DELETE_RETENTION_MS,
      );
      const publicAnonymousPreview = isPublicAnonymousNsfwPreview(viewerId, post.post);
      if (
        !ownerCanRestore &&
        !publicAnonymousPreview &&
        !(await canViewPost(viewerId, post.post, policyDependencies))
      ) {
        return null;
      }
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
