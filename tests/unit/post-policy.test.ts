import { describe, expect, it, vi } from "vitest";
import { readViewerLikedPostIds } from "../../app/data/viewer-post-likes";
import { canViewPost, createPostService, createPostSlug } from "../../worker/posts/service";
import type { ProfileStore } from "../../worker/profile/store";
import type { Relationship } from "../../worker/profile/types";
import type { PostStore } from "../../worker/posts/store";
import type { PostWithAuthor } from "../../worker/posts/types";

function post(overrides: Partial<PostWithAuthor["post"]> = {}): PostWithAuthor {
  return {
    post: {
      id: "post-1",
      authorId: "author-1",
      authorMode: "IDENTIFIED",
      isNsfw: false,
      nsfwMarkedBy: null,
      nsfwMarkedAt: null,
      title: "A source request",
      slug: "a-source-request",
      description: "Description",
      imageAssetId: "asset-1",
      visibility: "PUBLIC",
      status: "OPEN",
      commentCount: 0,
      likeCount: 0,
      acceptedCommentId: null,
      verifiedSourceId: null,
      createdAt: 1,
      updatedAt: 1,
      editDeadlineAt: 10_000,
      archivedAt: null,
      deletedAt: null,
      hiddenAt: null,
      lockedAt: null,
      ...overrides,
    },
    author: {
      userId: "author-1",
      username: "aurora",
      displayName: "Aurora Vale",
      avatarAssetId: null,
    },
    media: {
      id: "asset-1",
      ownerUserId: "author-1",
      purpose: "POST_IMAGE",
      r2Key: "posts/random/asset-1",
      contentType: "image/png",
      byteSize: 100,
      width: 1,
      height: 1,
      checksumSha256: "hash",
      status: "ACTIVE",
      createdAt: 1,
      deletedAt: null,
    },
  };
}

function dependencies() {
  const getRelationship = vi.fn(async (): Promise<Relationship> => "NONE");
  const getBlock = vi.fn(async () => false);
  const listFeed = vi.fn(async () => ({ posts: [post()], nextCursor: null }));
  const getPost = vi.fn(async () => post());
  const profileStore = {
    getProfileByUserId: vi.fn(async () => ({
      userId: "author-1",
      username: "aurora",
      usernameNormalized: "aurora",
      displayName: "Aurora Vale",
      bio: "",
      avatarAssetId: null,
      bannerAssetId: null,
      profileVisibility: "PUBLIC" as const,
      createdAt: 1,
      updatedAt: 1,
    })),
    getRelationship,
    getBlock,
    getPreferences: vi.fn(async () => ({
      userId: "viewer-1",
      hideNsfw: true,
      blurNsfw: true,
      allowNsfwDirectOverride: false,
      allowFriendRequests: true,
      createdAt: 1,
      updatedAt: 1,
    })),
  } as unknown as ProfileStore;
  const store = {
    getPost,
    getPostForMedia: vi.fn(async () => post()),
    getNsfwPost: vi.fn(async () => ({
      id: "post-1",
      authorUserId: "author-1",
      isNsfw: false,
      nsfwMarkedBy: null,
    })),
    listFeed,
    createPost: vi.fn(async () => undefined),
    updatePost: vi.fn(async () => true),
    archivePost: vi.fn(async () => true),
    deletePost: vi.fn(async () => true),
    getMediaAsset: vi.fn(async () => null),
    listIndexablePosts: vi.fn(async () => []),
  } as unknown as PostStore;
  return { profileStore, store, getRelationship, getBlock, listFeed, getPost };
}

describe("Phase 4 post policy", () => {
  it("creates stable readable slugs without trusting client IDs", () => {
    expect(createPostSlug("¿Dónde está la fuente?", "post-123456789")).toBe("donde-esta-la-fuente");
    expect(createPostSlug("!!!", "post-123456789")).toBe("source-request-post-1234567");
  });

  it("enforces friend-only visibility and both-direction blocks", async () => {
    const { profileStore, store, getRelationship, getBlock } = dependencies();
    await expect(
      canViewPost("viewer-1", post({ visibility: "FRIENDS_ONLY" }).post, {
        profileStore,
        store,
        now: () => 2,
      }),
    ).resolves.toBe(false);
    getRelationship.mockResolvedValue("FRIEND");
    await expect(
      canViewPost("viewer-1", post({ visibility: "FRIENDS_ONLY" }).post, {
        profileStore,
        store,
        now: () => 2,
      }),
    ).resolves.toBe(true);
    getBlock.mockResolvedValue(true);
    await expect(
      canViewPost("viewer-1", post().post, { profileStore, store, now: () => 2 }),
    ).resolves.toBe(false);
  });

  it("applies hide_nsfw before serializing a feed result", async () => {
    const { profileStore, store, listFeed } = dependencies();
    listFeed.mockResolvedValue({
      posts: [post({ isNsfw: true }), post({ id: "safe" })],
      nextCursor: null,
    });
    const service = createPostService({ store, profileStore, now: () => 2 });
    const result = await service.listFeed({
      viewerId: "viewer-1",
      kind: "recent",
      cursor: null,
      limit: 20,
    });
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.id).toBe("safe");
    expect(result.posts[0]?.imageUrl).toBe("/api/media/post/asset-1");
  });

  it("reads an authenticated viewer's existing post likes from reactions", async () => {
    let sql = "";
    const statement = {
      bind: vi.fn(() => statement),
      all: vi.fn(async () => ({ results: [{ targetId: "post-1" }] })),
    };
    const db = {
      prepare: vi.fn((query: string) => {
        sql = query;
        return statement;
      }),
    } as unknown as D1Database;

    const likedIds = await readViewerLikedPostIds(db, "viewer-1", ["post-1", "post-2"]);

    expect(likedIds.has("post-1")).toBe(true);
    expect(likedIds.has("post-2")).toBe(false);
    expect(sql).toContain("target_type = 'POST'");
    expect(sql).toContain("reaction_type = 'LIKE'");
    expect(statement.bind).toHaveBeenCalledWith("viewer-1", "post-1", "post-2");
  });

  it("rejects anonymous friends-only posts before writing", async () => {
    const { profileStore, store } = dependencies();
    const service = createPostService({ store, profileStore, now: () => 2 });
    await expect(
      service.createPost({
        id: "post-2",
        authorId: "author-1",
        authorMode: "ANONYMOUS",
        isNsfw: false,
        title: "Private identity",
        description: "Description",
        visibility: "FRIENDS_ONLY",
        image: {
          id: "asset-2",
          r2Key: "posts/random/asset-2",
          contentType: "image/png",
          byteSize: 100,
          width: 1,
          height: 1,
          checksumSha256: "hash",
          createdAt: 2,
        },
      }),
    ).rejects.toMatchObject({ code: "ANONYMOUS_FRIENDS_ONLY_UNSUPPORTED" });
    expect(store.createPost).not.toHaveBeenCalled();
  });

  it("serializes anonymous posts without identity-bearing public fields", async () => {
    const { profileStore, store, getPost } = dependencies();
    getPost.mockResolvedValue(post({ authorMode: "ANONYMOUS" }));
    const service = createPostService({ store, profileStore, now: () => 2 });

    const publicPost = await service.getPost("post-1", "viewer-1");
    expect(publicPost?.author).toEqual({ mode: "ANONYMOUS", displayName: "Anonymous Author" });
    expect(publicPost?.author.username).toBeUndefined();
    expect(publicPost?.author.profileUrl).toBeUndefined();
    expect(publicPost?.permissions.canRevealAnonymous).toBe(false);
  });

  it("keeps the real anonymous author behind an explicit internal service seam", async () => {
    const { profileStore, store, getPost } = dependencies();
    getPost.mockResolvedValue(post({ authorMode: "ANONYMOUS" }));
    const service = createPostService({ store, profileStore, now: () => 2 });

    await expect(service.getAnonymousAuthorForAdmin("post-1")).resolves.toEqual({
      userId: "author-1",
      username: "aurora",
    });
  });

  it("allows a capability-authorized moderation seam without changing ownership", async () => {
    const { profileStore, store } = dependencies();
    const service = createPostService({ store, profileStore, now: () => 2 });

    await service.setNsfw("post-1", "moderator-1", true, { allowModeration: true });
    expect(store.updatePost).toHaveBeenCalledWith(
      expect.objectContaining({ allowNonOwner: true, editorUserId: "moderator-1" }),
    );
  });
});
