import { describe, expect, it, vi } from "vitest";
import { createPostService } from "../../worker/posts/service";
import type { ProfileStore } from "../../worker/profile/store";
import type { PostStore } from "../../worker/posts/store";
import type { PostWithAuthor } from "../../worker/posts/types";

function fixture(): PostWithAuthor {
  return {
    post: {
      id: "post-emote-1",
      authorId: "author-1",
      authorMode: "IDENTIFIED",
      isNsfw: false,
      nsfwMarkedBy: null,
      nsfwMarkedAt: null,
      title: "Emote post",
      slug: "emote-post",
      description: "See :wave: here",
      categorySlug: "other",
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
    },
    author: {
      userId: "author-1",
      username: "author",
      displayName: "Author",
      avatarAssetId: null,
    },
    media: {
      id: "asset-1",
      ownerUserId: "author-1",
      purpose: "POST_IMAGE",
      r2Key: "posts/asset-1",
      contentType: "image/png",
      byteSize: 10,
      width: 1,
      height: 1,
      checksumSha256: "checksum",
      status: "ACTIVE",
      createdAt: 1,
      deletedAt: null,
    },
  };
}

describe("post Markdown emote rendering", () => {
  it("hydrates entitled emotes once into the safe post rich-text DTO", async () => {
    const getEmoteAssets = vi.fn(
      async () =>
        new Map([
          [
            "wave",
            {
              id: "emote-1",
              label: "Wave",
              shortcode: "wave",
              url: "/api/media/catalog/emote/emote-1",
            },
          ],
        ]),
    );
    const profileStore = {
      getProfileByUserId: vi.fn(async () => null),
      getPreferences: vi.fn(async () => ({ hideNsfw: false, blurNsfw: false })),
      getBlock: vi.fn(async () => false),
      getRelationship: vi.fn(async () => "NONE" as const),
      getEmoteAssets,
    } as unknown as ProfileStore;
    const store = {
      getPost: vi.fn(async () => fixture()),
    } as unknown as PostStore;

    const result = await createPostService({ store, profileStore, now: () => 2 }).getPost(
      "post-emote-1",
      "viewer-1",
    );

    expect(getEmoteAssets).toHaveBeenCalledWith(["wave"], "viewer-1");
    expect(result?.descriptionRichtext).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "See " },
          {
            type: "emote",
            shortcode: ":wave:",
            id: "emote-1",
            label: "Wave",
            url: "/api/media/catalog/emote/emote-1",
          },
          { type: "text", text: " here" },
        ],
      },
    ]);
  });

  it("hydrates a feed batch with one entitled asset lookup", async () => {
    const getEmoteAssets = vi.fn(
      async () =>
        new Map([
          [
            "wave",
            {
              id: "emote-1",
              label: "Wave",
              shortcode: "wave",
              url: "/api/media/catalog/emote/emote-1",
            },
          ],
        ]),
    );
    const profileStore = {
      getProfileByUserId: vi.fn(async () => null),
      getPreferences: vi.fn(async () => ({ hideNsfw: false, blurNsfw: false })),
      getBlock: vi.fn(async () => false),
      getRelationship: vi.fn(async () => "NONE" as const),
      getEmoteAssets,
    } as unknown as ProfileStore;
    const first = fixture();
    const second = fixture();
    second.post = { ...second.post, id: "post-emote-2" };
    second.media = { ...second.media, id: "asset-2", r2Key: "posts/asset-2" };
    const store = {
      listFeed: vi.fn(async () => ({ posts: [first, second], nextCursor: null })),
    } as unknown as PostStore;

    const result = await createPostService({ store, profileStore, now: () => 2 }).listFeed({
      viewerId: "viewer-1",
      kind: "recent",
      cursor: null,
      limit: 2,
    });

    expect(getEmoteAssets).toHaveBeenCalledTimes(1);
    expect(getEmoteAssets).toHaveBeenCalledWith(["wave"], "viewer-1");
    expect(result.posts).toHaveLength(2);
    expect(result.posts.every((post) => post.descriptionRichtext?.[0]?.type === "paragraph")).toBe(
      true,
    );
  });
});
