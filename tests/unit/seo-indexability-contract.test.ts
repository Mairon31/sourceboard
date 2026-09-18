import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { localizedPageMeta } from "../../shared/seo/official-pages";

const read = (path: string) => readFileSync(path, "utf8");

describe("public indexability contract", () => {
  it("builds a self-canonical localized page with crawler metadata", () => {
    const entries = localizedPageMeta({
      locale: "es",
      path: "/category/anime",
      title: "Anime · SourceBoard",
      description: "Public anime source requests.",
    });
    expect(entries).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://srcboard.me/es/category/anime",
    });
    expect(entries).toContainEqual({
      name: "robots",
      content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    });
    expect(entries).toContainEqual({
      property: "og:url",
      content: "https://srcboard.me/es/category/anime",
    });
    expect(entries).toContainEqual({
      name: "twitter:image",
      content: "https://srcboard.me/sourceboard-brand-banner.jpg",
    });
  });

  it("attaches canonical metadata to every sitemap-backed public route family", () => {
    expect(read("app/routes/_index.tsx")).toContain("localizedPageMeta");
    expect(read("app/routes/category-index.tsx")).toContain("localizedPageMeta");
    expect(read("app/routes/category.tsx")).toContain("localizedPageMeta");
    expect(read("app/routes/docs.tsx")).toContain("localizedPageMeta");
    expect(read("app/routes/legal.tsx")).toContain("localizedPageMeta");
  });

  it("never uses redirect aliases as static article canonicals", () => {
    expect(read("app/routes/docs-article.tsx")).toContain(
      "path: `/en/docs/${encodeURIComponent(article.slug)}`",
    );
    expect(read("app/routes/legal-article.tsx")).toContain(
      "path: `/en/legal/${encodeURIComponent(article.slug)}`",
    );
    expect(read("app/components/product/DocsShell.tsx")).toContain(
      "href: `/${locale}/docs/${item.slug}`",
    );
    expect(read("app/routes/legal.tsx")).toContain("to={`/${data.locale}/legal/${policy.slug}`}");
  });

  it("uses only the current brand assets for institutional metadata and fallbacks", () => {
    expect(existsSync("public/sourceboard-brand-mark.jpg")).toBe(true);
    expect(existsSync("public/sourceboard-brand-lockup.jpg")).toBe(true);
    expect(existsSync("public/sourceboard-brand-banner.jpg")).toBe(true);
    const legacyOpenGraphAsset = ["sourceboard", "og"].join("-");
    const legacyLogoAsset = ["sourceboard", "logo"].join("-");
    for (const source of [
      "app/root.tsx",
      "shared/seo/official-pages.ts",
      "shared/seo/social-image.ts",
      "worker/share-image/api.ts",
    ]) {
      expect(read(source)).not.toContain(legacyOpenGraphAsset);
      expect(read(source)).not.toContain(legacyLogoAsset);
    }
  });
});
