import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPublicAnonymousNsfwPreview } from "../../worker/posts/service";

const postDetailRoute = readFileSync("app/routes/post-detail.tsx", "utf8");

describe("public anonymous NSFW post detail", () => {
  it("recognizes the safe blurred preview contract", () => {
    expect(
      isPublicAnonymousNsfwPreview(null, {
        visibility: "PUBLIC",
        isNsfw: true,
        deletedAt: null,
        hiddenAt: null,
      }),
    ).toBe(true);
  });

  it("does not treat authenticated, private, deleted, or safe posts as previews", () => {
    const base = {
      visibility: "PUBLIC" as const,
      isNsfw: true,
      deletedAt: null,
      hiddenAt: null,
    };
    expect(isPublicAnonymousNsfwPreview("viewer-1", base)).toBe(false);
    expect(isPublicAnonymousNsfwPreview(null, { ...base, visibility: "PRIVATE" })).toBe(false);
    expect(isPublicAnonymousNsfwPreview(null, { ...base, deletedAt: 1 })).toBe(false);
    expect(isPublicAnonymousNsfwPreview(null, { ...base, isNsfw: false })).toBe(false);
  });

  it("keeps public anonymous NSFW comments on the normal read path", () => {
    expect(postDetailRoute).toContain("listForPost(postId, userId, null, 50, commentSort)");
    expect(postDetailRoute).not.toContain("shouldSuppressCommentsForPublicNsfwPreview");
    expect(postDetailRoute).not.toContain("anonymousNsfwPreview");
  });
});
