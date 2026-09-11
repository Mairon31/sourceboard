import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  POST_CATEGORIES,
  findPostCategory,
  parsePostCategorySlug,
} from "../../shared/posts/categories";
import type { PostSummary } from "../../shared/ui/contracts";

function readSource(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const postStoreSource = readSource("../../worker/posts/store.ts");
const postApiSource = readSource("../../worker/posts/api.ts");
const composerSource = readSource("../../app/components/product/PostComposer.tsx");
const postCardSource = readSource("../../app/components/product/PostCard.tsx");
const categoryBadgeSource = readSource("../../app/components/product/PostCategoryBadge.tsx");
const categoryMigrationSource = readSource("../../migrations/0028_post_categories.sql");

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

  it("requires a category picker before publishing a source request", () => {
    expect(composerSource).toContain("<CategoryPicker");
    expect(composerSource).toContain('form.set("category", category)');
    expect(composerSource).toContain("!category");
  });

  it("renders post categories as linked badges with a non-linked mode", () => {
    expect(postCardSource).toContain("<PostCategoryBadge");
    expect(categoryBadgeSource).toContain("to={`/category/${category.slug}`}");
    expect(categoryBadgeSource).toContain("linked");
    expect(categoryBadgeSource).toContain("<span");
  });

  it("links category badges only for publicly discoverable posts", () => {
    expect(postCardSource).toContain(
      'linked={post.visibility === "PUBLIC" && post.status !== "ARCHIVED"}',
    );
  });

  it("explicitly backfills legacy posts into Other", () => {
    expect(categoryMigrationSource).toContain("UPDATE posts");
    expect(categoryMigrationSource).toContain("SET category_slug = 'other'");
  });
});
