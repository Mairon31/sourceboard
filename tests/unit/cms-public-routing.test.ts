import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("CMS public routing", () => {
  it("registers every CMS namespace on localized public routes", () => {
    const routes = read("app/routes.ts");
    const page = read("app/routes/page-article.tsx");
    const publicCms = read("app/data/cms-public.server.ts");
    expect(routes).toContain('route(`${locale}/docs/:slug`');
    expect(routes).toContain('route(`${locale}/legal/:slug`');
    expect(routes).toContain('route(`${locale}/pages/:slug`');
    expect(page).toContain('resolvePublicCmsPage(request, context, "PAGE", slug)');
    expect(publicCms).toContain('namespace === "DOCS" ? "docs" : namespace === "LEGAL" ? "legal" : "pages"');
  });

  it("keeps published CMS page SEO tied to actual published locale variants", () => {
    const page = read("app/routes/page-article.tsx");
    expect(page).toContain("resolution.actualPublishedVariants.map");
    expect(page).toContain("officialPageMeta");
    expect(page).toContain("redirect(cms.resolution.redirectTo, 301)");
  });
});
