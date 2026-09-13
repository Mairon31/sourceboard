import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { handlePublicSeoRequest } from "../../worker/seo/public";

const read = (path: string) => readFileSync(path, "utf8");

describe("public SEO resources", () => {
  it("wires robots and sitemap resources before the React Router handler", () => {
    expect(existsSync("worker/seo/public.ts")).toBe(true);
    expect(existsSync("worker/seo/sitemap-store.ts")).toBe(true);
    const app = read("worker/app.ts");
    expect(app).toContain('import { handlePublicSeoRequest } from "./seo/public"');
    expect(app).toContain("await handlePublicSeoRequest(request, env)");
  });

  it("publishes explicit bounded sitemap feeds for every public entity kind", () => {
    const seo = read("worker/seo/public.ts");
    expect(seo).toContain('pathname === "/robots.txt"');
    expect(seo).toContain('pathname === "/sitemap.xml"');
    expect(seo).toContain("/sitemaps/official-1.xml");
    expect(seo).toContain("/sitemaps/categories.xml");
    expect(seo).toContain("/sitemaps/posts-");
    expect(seo).toContain("/sitemaps/profiles-");
    expect(seo).toContain("Sitemap: https://srcboard.me/sitemap.xml");
    expect(seo).toContain('const CACHE_NAMESPACE = "seo:v3:"');
  });

  it("serves privacy-aware robots plus localized category and official sitemap responses", async () => {
    const robotsResponse = await handlePublicSeoRequest(
      new Request("https://srcboard.me/robots.txt"),
      {},
    );
    expect(robotsResponse?.status).toBe(200);
    expect(robotsResponse?.headers.get("cache-control")).toBe("public, max-age=300, s-maxage=300");
    const robots = await robotsResponse?.text();
    expect(robots).toContain("Disallow: /admin/");
    expect(robots).toContain("Disallow: /settings");
    expect(robots).toContain("Disallow: /resources/");
    expect(robots).toContain("Sitemap: https://srcboard.me/sitemap.xml");

    const categoriesResponse = await handlePublicSeoRequest(
      new Request("https://srcboard.me/sitemaps/categories.xml"),
      {},
    );
    expect(categoriesResponse?.status).toBe(200);
    const categoriesXml = await categoriesResponse?.text();
    expect(categoriesXml).toContain("https://srcboard.me/en/category/anime");
    expect(categoriesXml).toContain("https://srcboard.me/es/category/anime");
    expect(categoriesXml).not.toContain("/sh/");
    expect(categoriesXml).not.toContain("/admin");

    const officialResponse = await handlePublicSeoRequest(
      new Request("https://srcboard.me/sitemaps/official-1.xml"),
      {},
    );
    expect(officialResponse?.status).toBe(200);
    const officialXml = await officialResponse?.text();
    expect(officialXml).toContain("https://srcboard.me/en/store");
    expect(officialXml).toContain("https://srcboard.me/en/docs");
    expect(officialXml).toContain("https://srcboard.me/en/legal");
  });

  it("returns null for non-SEO paths and 503 when the dynamic index lacks D1", async () => {
    expect(await handlePublicSeoRequest(new Request("https://srcboard.me/store"), {})).toBeNull();
    const dynamic = await handlePublicSeoRequest(
      new Request("https://srcboard.me/sitemap.xml"),
      {},
    );
    expect(dynamic?.status).toBe(503);
    expect(dynamic?.headers.get("cache-control")).toBe("no-store");
  });

  it("uses bounded keyset pagination instead of OFFSET scans", () => {
    const store = read("worker/seo/sitemap-store.ts");
    expect(store).toContain("SITEMAP_PAGE_SIZE = 1_000");
    expect(store).toContain("p.updated_at < ? OR (p.updated_at = ? AND p.id < ?)");
    expect(store).toContain("up.updated_at < ? OR (up.updated_at = ? AND u.username > ?)");
    expect(store).not.toMatch(/\bOFFSET\b/i);
  });

  it("excludes every non-public or sensitive post state from sitemap SQL", () => {
    const store = read("worker/seo/sitemap-store.ts");
    expect(store).toContain("p.visibility = 'PUBLIC'");
    expect(store).toContain("p.deleted_at IS NULL");
    expect(store).toContain("p.hidden_at IS NULL");
    expect(store).toContain("p.archived_at IS NULL");
    expect(store).toContain("p.is_nsfw = 0");
  });

  it("indexes only public active profiles and never selects private identity fields", () => {
    const store = read("worker/seo/sitemap-store.ts");
    expect(store).toContain("up.profile_visibility = 'PUBLIC'");
    expect(store).toContain("u.status = 'ACTIVE'");
    expect(store).not.toContain("email_encrypted");
    expect(store).not.toContain("email_lookup_hash");
  });

  it("includes only published current CMS routes in official sitemap SQL", () => {
    const seo = read("worker/seo/public.ts");
    expect(seo).toContain("s.status = 'PUBLISHED'");
    expect(seo).toContain("r.is_current = 1");
    expect(seo).toContain("s.published_revision_id IS NOT NULL");
    expect(seo).not.toContain("DRAFT");
  });

  it("marks NSFW post metadata noindex until site policy explicitly enables indexing", () => {
    const route = read("app/routes/post-detail.tsx");
    expect(route).toContain("post.isNsfw ||");
  });

  it("exposes post modification time to SSR and JSON-LD", () => {
    const contracts = read("shared/ui/contracts.ts");
    const service = read("worker/posts/service.ts");
    const route = read("app/routes/post-detail.tsx");
    expect(contracts).toContain("updatedAt: string;");
    expect(service).toContain("updatedAt: new Date(post.post.updatedAt).toISOString()");
    expect(route).toContain("dateModified: post.updatedAt");
  });
});
