import { describe, expect, it, vi } from "vitest";
import type { PostWithAuthor } from "../../worker/posts/types";
import {
  createShareImageRequestHandler,
  handleShareImageRequest,
  renderShareImage,
} from "../../worker/share-image/api";

function makePost(overrides: Partial<PostWithAuthor["post"]> = {}): PostWithAuthor {
  return {
    post: {
      id: "post-1",
      authorId: "user-1",
      authorMode: "IDENTIFIED",
      isNsfw: false,
      nsfwMarkedBy: null,
      nsfwMarkedAt: null,
      title: "A source request",
      slug: "a-source-request",
      description: "Description",
      categorySlug: "other",
      imageAssetId: "media-1",
      visibility: "PUBLIC",
      status: "OPEN",
      commentCount: 0,
      likeCount: 0,
      acceptedCommentId: null,
      verifiedSourceId: null,
      createdAt: 1,
      updatedAt: 2,
      editDeadlineAt: 3,
      archivedAt: null,
      deletedAt: null,
      hiddenAt: null,
      lockedAt: null,
      commentsClosed: false,
      commentsClosedAt: null,
      ...overrides,
    },
    author: {
      userId: "user-1",
      username: "author",
      displayName: "Author",
      avatarAssetId: null,
    },
    media: {
      id: "media-1",
      ownerUserId: "user-1",
      purpose: "POST_IMAGE",
      r2Key: "media/post-1",
      contentType: "image/jpeg",
      byteSize: 10,
      width: 1200,
      height: 800,
      checksumSha256: "checksum",
      status: "ACTIVE",
      createdAt: 1,
      deletedAt: null,
    },
  };
}

function imageResponse(body = "image") {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "image/jpeg" },
  });
}

describe("share image endpoint", () => {
  it("serves a public normal post image through its controlled media URL", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(imageResponse());

    const response = await renderShareImage(
      new Request("https://srcboard.me/api/share-image/post-1"),
      "post-1",
      { readPost: async () => makePost(), fetcher },
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledWith("https://srcboard.me/api/media/post/media-1");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
  });

  it("applies a strong Cloudflare image transform for sensitive posts", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(imageResponse());

    const response = await renderShareImage(
      new Request("https://srcboard.me/api/share-image/post-1?v=2"),
      "post-1",
      { readPost: async () => makePost({ isNsfw: true }), fetcher },
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledWith(
      "https://srcboard.me/api/media/post/media-1",
      expect.objectContaining({
        cf: {
          image: expect.objectContaining({ blur: expect.any(Number), width: 1200, height: 630 }),
        },
      }),
    );
  });

  it("uses a safe placeholder when a sensitive transform fails", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("original-sensitive-image", { status: 502 }))
      .mockResolvedValueOnce(
        new Response("safe-placeholder", {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      );

    const response = await renderShareImage(
      new Request("https://srcboard.me/api/share-image/post-1"),
      "post-1",
      { readPost: async () => makePost({ isNsfw: true }), fetcher },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("safe-placeholder");
    expect(fetcher).toHaveBeenLastCalledWith("https://srcboard.me/sourceboard-brand-banner.jpg");
  });

  it.each([
    ["missing", null],
    ["private", makePost({ visibility: "PRIVATE" })],
    ["deleted", makePost({ deletedAt: 10 })],
    ["hidden", makePost({ hiddenAt: 10 })],
  ])("does not expose a %s post", async (_label, post) => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await renderShareImage(
      new Request("https://srcboard.me/api/share-image/post-1?url=https://attacker.test/a.jpg"),
      "post-1",
      { readPost: async () => post, fetcher },
    );

    expect(response.status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns the safe placeholder for a public post without usable media", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("safe-placeholder", {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const post = makePost();
    post.media = null as never;

    const response = await renderShareImage(
      new Request("https://srcboard.me/api/share-image/post-1"),
      "post-1",
      { readPost: async () => post, fetcher },
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledWith("https://srcboard.me/sourceboard-brand-banner.jpg");
  });

  it("only claims its exact public route and does not accept arbitrary proxy input", async () => {
    const unrelated = await handleShareImageRequest(
      new Request("https://srcboard.me/api/share-image?url=https://attacker.test/image.jpg"),
      "request-1",
      {},
    );
    const unavailable = await handleShareImageRequest(
      new Request("https://srcboard.me/api/share-image/post-1?url=https://attacker.test/image.jpg"),
      "request-1",
      {},
    );

    expect(unrelated).toBeNull();
    expect(unavailable?.status).toBe(503);
  });

  it("resolves the public route by post ID while ignoring a remote URL query", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(imageResponse());
    const handler = createShareImageRequestHandler({ readPost: async () => makePost(), fetcher });

    const response = await handler(
      new Request("https://srcboard.me/api/share-image/post-1?url=https://attacker.test/a.jpg"),
      "request-1",
    );

    expect(response?.status).toBe(200);
    expect(fetcher).toHaveBeenCalledWith("https://srcboard.me/api/media/post/media-1");
  });

  it("does not trust an external-looking stored media identifier", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(imageResponse());
    const post = makePost();
    post.media.id = "https://attacker.test/original.jpg";

    await renderShareImage(new Request("https://srcboard.me/api/share-image/post-1"), "post-1", {
      readPost: async () => post,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://srcboard.me/api/media/post/https%3A%2F%2Fattacker.test%2Foriginal.jpg",
    );
  });
});
