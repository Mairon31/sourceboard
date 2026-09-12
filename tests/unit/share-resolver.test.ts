import { describe, expect, it } from "vitest";
import {
  buildShareResolverMeta,
  resolveShareTarget,
  type ShareResolverDependencies,
} from "../../app/routes/share-resolver";

function dependencies(
  overrides: Partial<ShareResolverDependencies> = {},
): ShareResolverDependencies {
  return {
    resolveShortId: async (shortId) =>
      shortId === "PostShare01"
        ? {
            shortId,
            resourceType: "POST",
            resourceId: "post-1",
            createdAt: 1,
          }
        : shortId === "CommShare01"
          ? {
              shortId,
              resourceType: "COMMENT",
              resourceId: "comment-1",
              createdAt: 1,
            }
          : null,
    loadPublicPost: async (postId) =>
      postId === "post-1"
        ? {
            id: "post-1",
            slug: "original-image",
            title: "Original image source",
            description: "Help identify the original image source.",
            imageUrl: "/api/media/post/media-1",
          }
        : null,
    loadComment: async (commentId) =>
      commentId === "comment-1"
        ? {
            id: "comment-1",
            postId: "post-1",
            plaintext:
              "This comment contains useful source context that should be bounded before it becomes social metadata. ".repeat(
                4,
              ),
            state: "VISIBLE",
            deletedAt: null,
            hiddenAt: null,
          }
        : null,
    ...overrides,
  };
}

async function expectNotFound(promise: Promise<unknown>) {
  try {
    await promise;
    throw new Error("Expected resolver to throw a 404 response.");
  } catch (error) {
    expect(error).toBeInstanceOf(Response);
    expect((error as Response).status).toBe(404);
  }
}

describe("share resolver", () => {
  it("builds crawler metadata and preserves only an explicitly supported locale for public posts", async () => {
    const data = await resolveShareTarget(
      {
        shortId: "PostShare01",
        requestUrl: new URL("https://srcboard.me/sh/PostShare01?lang=es"),
      },
      dependencies(),
    );

    expect(data.resourceType).toBe("POST");
    expect(data.locale).toBe("es");
    expect(data.canonicalUrl).toBe("https://srcboard.me/posts/post-1/original-image");
    expect(data.targetUrl).toBe("https://srcboard.me/posts/post-1/original-image?lang=es");
    expect(data.imageUrl).toBe("https://srcboard.me/api/media/post/media-1");

    const meta = buildShareResolverMeta(data);
    expect(meta).toContainEqual({ name: "robots", content: "noindex, follow" });
    expect(meta).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://srcboard.me/posts/post-1/original-image",
    });
    expect(meta).toContainEqual({ property: "og:title", content: "Original image source" });
  });

  it("builds bounded comment context and anchors canonical navigation to the comment", async () => {
    const data = await resolveShareTarget(
      {
        shortId: "CommShare01",
        requestUrl: new URL("https://srcboard.me/sh/CommShare01"),
      },
      dependencies(),
    );

    expect(data.resourceType).toBe("COMMENT");
    expect(data.canonicalUrl).toBe(
      "https://srcboard.me/posts/post-1/original-image#comment-comment-1",
    );
    expect(data.targetUrl).toBe(data.canonicalUrl);
    expect(data.title).toBe("Comment on Original image source");
    expect(data.description.length).toBeLessThanOrEqual(180);
    expect(data.description).toContain("useful source context");
  });

  it("throws the same 404 for missing/private posts and deleted comments", async () => {
    await expectNotFound(
      resolveShareTarget(
        {
          shortId: "PostShare01",
          requestUrl: new URL("https://srcboard.me/sh/PostShare01"),
        },
        dependencies({ loadPublicPost: async () => null }),
      ),
    );

    await expectNotFound(
      resolveShareTarget(
        {
          shortId: "CommShare01",
          requestUrl: new URL("https://srcboard.me/sh/CommShare01"),
        },
        dependencies({
          loadComment: async () => ({
            id: "comment-1",
            postId: "post-1",
            plaintext: "Deleted source detail",
            state: "DELETED",
            deletedAt: 123,
            hiddenAt: null,
          }),
        }),
      ),
    );
  });

  it("drops unsupported lang input instead of forwarding arbitrary query data", async () => {
    const data = await resolveShareTarget(
      {
        shortId: "PostShare01",
        requestUrl: new URL("https://srcboard.me/sh/PostShare01?lang=../../private&token=secret"),
      },
      dependencies(),
    );

    expect(data.locale).toBe("en");
    expect(data.targetUrl).toBe(data.canonicalUrl);
    expect(data.targetUrl).not.toContain("token");
    expect(data.targetUrl).not.toContain("private");
  });
});
