import { describe, expect, it } from "vitest";
import { shouldSuppressCommentsForPublicNsfwPreview } from "../../app/routes/post-detail";
import { isPublicAnonymousNsfwPreview } from "../../worker/posts/service";

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

  it("suppresses comments in the blurred anonymous detail without suppressing the post shell", () => {
    expect(
      shouldSuppressCommentsForPublicNsfwPreview(null, {
        visibility: "PUBLIC",
        isNsfw: true,
      }),
    ).toBe(true);
    expect(
      shouldSuppressCommentsForPublicNsfwPreview("viewer-1", {
        visibility: "PUBLIC",
        isNsfw: true,
      }),
    ).toBe(false);
  });
});
