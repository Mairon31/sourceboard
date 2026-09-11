import { describe, expect, it } from "vitest";
import {
  POST_CATEGORIES,
  findPostCategory,
  parsePostCategorySlug,
} from "../../shared/posts/categories";

describe("post categories", () => {
  it("ships the approved 24-category catalog", () => {
    expect(POST_CATEGORIES).toHaveLength(24);
    expect(POST_CATEGORIES.map((item) => item.slug)).toContain("anime");
    expect(POST_CATEGORIES.map((item) => item.slug)).toContain("lost-media");
    expect(POST_CATEGORIES.map((item) => item.slug)).toContain("cars-vehicles");
    expect(POST_CATEGORIES.at(-1)?.slug).toBe("other");
  });

  it("normalizes labels and aliases without accepting unknown slugs", () => {
    expect(findPostCategory("Manga")?.slug).toBe("manga-manhwa");
    expect(findPostCategory("social media")?.slug).toBe("social-media");
    expect(parsePostCategorySlug("not-a-category")).toBeNull();
  });
});
