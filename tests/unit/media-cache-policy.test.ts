import { describe, expect, it } from "vitest";
import { postMediaCacheControl } from "../../worker/posts/api";
import type { PostRecord } from "../../worker/posts/types";

function post(overrides: Partial<PostRecord> = {}): PostRecord {
  return {
    id: "post-1",
    authorId: "author-1",
    authorMode: "IDENTIFIED",
    isNsfw: false,
    nsfwMarkedBy: null,
    nsfwMarkedAt: null,
    title: "Post",
    slug: "post",
    description: "",
    categorySlug: "other",
    imageAssetId: "media-1",
    visibility: "PUBLIC",
    status: "OPEN",
    commentCount: 0,
    likeCount: 0,
    acceptedCommentId: null,
    verifiedSourceId: null,
    createdAt: 1,
    updatedAt: 1,
    editDeadlineAt: 2,
    archivedAt: null,
    deletedAt: null,
    hiddenAt: null,
    lockedAt: null,
    commentsClosed: false,
    commentsClosedAt: null,
    ...overrides,
  };
}

describe("post media cache policy", () => {
  it("allows bounded public caching for public non-sensitive active posts", () => {
    expect(postMediaCacheControl(post())).toBe("public, max-age=3600");
  });

  it.each([
    { visibility: "UNLISTED" as const },
    { visibility: "FRIENDS_ONLY" as const },
    { visibility: "PRIVATE" as const },
    { deletedAt: 10 },
    { hiddenAt: 10 },
  ])("does not cache restricted post media publicly (%o)", (overrides) => {
    expect(postMediaCacheControl(post(overrides))).toBe("private, no-store");
  });

  it("allows public caching for NSFW media so crawlers can fetch the declared image", () => {
    expect(postMediaCacheControl(post({ isNsfw: true }))).toBe("public, max-age=3600");
  });

  it("keeps public archived post media readable and cacheable", () => {
    expect(postMediaCacheControl(post({ status: "ARCHIVED" }))).toBe("public, max-age=3600");
  });
});
