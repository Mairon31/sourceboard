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
      commentsClosed: false,
      commentsClosedAt: null,
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

function acceptedPost(overrides: Partial<PostWithAuthor["post"]> = {}): PostWithAuthor {
  return {
    ...post({ acceptedCommentId: "accepted-comment", status: "ANSWERED", ...overrides }),
    acceptedSource: {
      commentId: "accepted-comment",
      canonicalUrl: "https://example.com/source",
      acceptedAt: 2,
    },
  };
}

function dependencies() {
  const getRelationship = vi.fn(async (): Promise<Relationship> => "NONE");
  const getBlock = vi.fn(async () => false);
  const listFeed = vi.fn(async () => ({ posts: [post()], nextCursor: null }));
  const listByAuthor = vi.fn(async () => ({ posts: [post()], nextCursor: null }));
  const listAcceptedByContributor = vi.fn(
    async (): Promise<{ posts: PostWithAuthor[]; nextCursor: string | null }> => ({
      posts: [],
      nextCursor: null,
    }),
  );
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
    listByAuthor,
    listAcceptedByContributor,
    createPost: vi.fn(async () => undefined),
    updatePost: vi.fn(async () => true),
    archivePost: vi.fn(async () => true),
    setCommentsClosed: vi.fn(async () => true),
    deletePost: vi.fn(async () => true),
    getMediaAsset: vi.fn(async () => null),
    listIndexablePosts: vi.fn(async () => []),
  } as unknown as PostStore;
  return {
    profileStore,
    store,
    getRelationship,
    getBlock,
    listFeed,
    listByAuthor,
    listAcceptedByContributor,
    getPost,
  };
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

  it("keeps profile activity discoverable-only for visitors", async () => {
    const { profileStore, store, getRelationship, listByAuthor } = dependencies();
    listByAuthor.mockResolvedValue({
      posts: [
        post({ id: "public", visibility: "PUBLIC" }),
        post({ id: "friend-only", visibility: "FRIENDS_ONLY" }),
        post({ id: "unlisted", visibility: "UNLISTED" }),
        post({ id: "private", visibility: "PRIVATE" }),
        post({ id: "anonymous", authorMode: "ANONYMOUS", visibility: "PUBLIC" }),
      ],
      nextCursor: null,
    });
    const service = createPostService({ store, profileStore, now: () => 2 }) as unknown as {
      listProfileActivity(input: {
        authorId: string;
        viewerId: string | null;
        limit: number;
      }): Promise<{ posts: Array<{ id: string }> }>;
    };

    const stranger = await service.listProfileActivity({
      authorId: "author-1",
      viewerId: "viewer-1",
      limit: 20,
    });
    expect(stranger.posts.map((item) => item.id)).toEqual(["public"]);

    getRelationship.mockResolvedValue("FRIEND");
    const friend = await service.listProfileActivity({
      authorId: "author-1",
      viewerId: "viewer-1",
      limit: 20,
    });
    expect(friend.posts.map((item) => item.id)).toEqual(["public", "friend-only"]);
  });

  it("lets owners see their own non-hidden profile activity", async () => {
    const { profileStore, store, listByAuthor } = dependencies();
    listByAuthor.mockResolvedValue({
      posts: [
        post({ id: "public", visibility: "PUBLIC" }),
        post({ id: "unlisted", visibility: "UNLISTED" }),
        post({ id: "private", visibility: "PRIVATE" }),
        post({ id: "anonymous", authorMode: "ANONYMOUS", visibility: "PUBLIC" }),
      ],
      nextCursor: null,
    });
    const service = createPostService({ store, profileStore, now: () => 2 }) as unknown as {
      listProfileActivity(input: {
        authorId: string;
        viewerId: string | null;
        limit: number;
      }): Promise<{ posts: Array<{ id: string }> }>;
    };

    const owner = await service.listProfileActivity({
      authorId: "author-1",
      viewerId: "author-1",
      limit: 20,
    });
    expect(owner.posts.map((item) => item.id)).toEqual([
      "public",
      "unlisted",
      "private",
      "anonymous",
    ]);
  });

  it("builds Accepted Sources from the profile's accepted comments, not its resolved requests", async () => {
    const { profileStore, store, listByAuthor, listAcceptedByContributor } = dependencies();
    listByAuthor.mockResolvedValue({
      posts: [acceptedPost({ id: "authored-resolved" })],
      nextCursor: null,
    });
    listAcceptedByContributor.mockResolvedValue({
      posts: [acceptedPost({ id: "contributed-source", authorId: "request-owner" })],
      nextCursor: null,
    });
    const service = createPostService({ store, profileStore, now: () => 2 }) as unknown as {
      listProfileActivity(input: {
        authorId: string;
        viewerId: string | null;
        limit: number;
      }): Promise<{
        posts: Array<{ id: string }>;
        acceptedSources: Array<{ id: string }>;
      }>;
    };

    const activity = await service.listProfileActivity({
      authorId: "author-1",
      viewerId: "viewer-1",
      limit: 20,
    });

    expect(activity.posts.map((item) => item.id)).toEqual(["authored-resolved"]);
    expect(activity.acceptedSources.map((item) => item.id)).toEqual(["contributed-source"]);
  });

  it("keeps accepted contribution discovery privacy-safe without hiding anonymous requests", async () => {
    const { profileStore, store, listAcceptedByContributor } = dependencies();
    listAcceptedByContributor.mockResolvedValue({
      posts: [
        acceptedPost({ id: "accepted-public", authorId: "request-owner" }),
        acceptedPost({
          id: "accepted-anonymous-request",
          authorId: "anonymous-owner",
          authorMode: "ANONYMOUS",
        }),
        acceptedPost({
          id: "accepted-unlisted",
          authorId: "request-owner",
          visibility: "UNLISTED",
        }),
        acceptedPost({ id: "accepted-private", authorId: "request-owner", visibility: "PRIVATE" }),
      ],
      nextCursor: null,
    });
    const service = createPostService({ store, profileStore, now: () => 2 }) as unknown as {
      listProfileActivity(input: {
        authorId: string;
        viewerId: string | null;
        limit: number;
      }): Promise<{ acceptedSources: Array<{ id: string }> }>;
    };

    const stranger = await service.listProfileActivity({
      authorId: "author-1",
      viewerId: "viewer-1",
      limit: 20,
    });
    expect(stranger.acceptedSources.map((item) => item.id)).toEqual([
      "accepted-public",
      "accepted-anonymous-request",
    ]);

    const owner = await service.listProfileActivity({
      authorId: "author-1",
      viewerId: "author-1",
      limit: 20,
    });
    expect(owner.acceptedSources.map((item) => item.id)).toEqual([
      "accepted-public",
      "accepted-anonymous-request",
      "accepted-unlisted",
    ]);
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

  it("only lets the author close comments after accepting a source", async () => {
    const { profileStore, store, getPost } = dependencies();
    const service = createPostService({ store, profileStore, now: () => 2 });
    const setCommentsClosed = (
      service as unknown as {
        setCommentsClosed(postId: string, authorId: string, closed: boolean): Promise<unknown>;
      }
    ).setCommentsClosed;

    await expect(setCommentsClosed.call(service, "post-1", "author-1", true)).rejects.toMatchObject(
      {
        code: "POST_SOURCE_REQUIRED",
      },
    );
    getPost.mockResolvedValue(
      post({ acceptedCommentId: "comment-1" }) as Awaited<ReturnType<typeof getPost>>,
    );
    await expect(
      setCommentsClosed.call(service, "post-1", "author-1", true),
    ).resolves.toBeDefined();
  });
});
