import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  POST_CATEGORIES,
  findPostCategory,
  parsePostCategorySlug,
} from "../../shared/posts/categories";
import type { PostSummary } from "../../shared/ui/contracts";

const postStoreSource = readFileSync(new URL("../../worker/posts/store.ts", import.meta.url), "utf8");
const postApiSource = readFileSync(new URL("../../worker/posts/api.ts", import.meta.url), "utf8");

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

  it("exposes the canonical category slug through post DTOs and persistence", () => {
    const summary: Pick<PostSummary, "categorySlug"> = { categorySlug: "anime" };

    expect(summary.categorySlug).toBe("anime");
    expect(postStoreSource).toContain("p.category_slug");
    expect(postApiSource).toContain('form.get("category")');
  });
});
