import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findPostCategory, parsePostCategorySlug } from "../../shared/posts/categories";

function readSource(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const routesSource = readSource("../../app/routes.ts");
const categoryIndexSource = readSource("../../app/routes/category-index.tsx");
const categoryRouteSource = readSource("../../app/routes/category.tsx");
const homeSource = readSource("../../app/routes/_index.tsx");
const feedResourceSource = readSource("../../app/routes/feed-resource.tsx");

describe("category routing", () => {
  it("keeps catalog resolution canonical and rejects unknown values", () => {
    expect(findPostCategory("Anime")?.slug).toBe("anime");
    expect(findPostCategory("social media")?.slug).toBe("social-media");
    expect(parsePostCategorySlug("not-real")).toBeNull();
  });

  it("registers localized category feeds and keeps unprefixed routes as locale aliases", () => {
    expect(routesSource).toContain('route("category", "routes/official-alias.tsx"');
    expect(routesSource).toContain('route("category/:categorySlug", "routes/official-alias.tsx"');
    expect(routesSource).toContain('route(`${locale}/category`, "routes/category-index.tsx"');
    expect(routesSource).toContain('route(`${locale}/category/:categorySlug`, "routes/category.tsx"');
  });

  it("canonicalizes recognized category queries without mapping unknown values to Other", () => {
    expect(categoryIndexSource).toContain("findPostCategory");
    expect(categoryIndexSource).toContain("redirect(`/category/${category.slug}`)");
    expect(categoryIndexSource).toContain("Category not found");
    expect(categoryIndexSource).not.toContain('redirect("/category/other")');
  });

  it("uses strict category slugs for the server-rendered category feed", () => {
    expect(categoryRouteSource).toContain("parsePostCategorySlug");
    expect(categoryRouteSource).toContain("status: 404");
    expect(categoryRouteSource).toContain("categorySlug: category.slug");
  });

  it("threads category URL state through Home and the feed resource", () => {
    expect(homeSource).toContain("parsePostCategorySlug");
    expect(homeSource).toContain('searchParams.get("category")');
    expect(homeSource).toContain('next.set("category", nextCategory)');
    expect(homeSource).toContain("feedCacheKey(feed, nextCategory)");
    expect(feedResourceSource).toContain("parsePostCategorySlug");
    expect(feedResourceSource).toContain("categorySlug");
  });
});
