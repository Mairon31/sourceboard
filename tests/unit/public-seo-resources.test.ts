import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { handlePublicSeoRequest } from "../../worker/seo/public";

const read = (path: string) => readFileSync(path, "utf8");

describe("public SEO resources", () => {
  it("wires robots and sitemap resources before the React Router handler", () => {
    expect(existsSync("worker/seo/public.ts")).toBe(true);
    const app = read("worker/app.ts");
    expect(app).toContain('import { handlePublicSeoRequest } from "./seo/public"');
    expect(app).toContain("await handlePublicSeoRequest(request, env)");
  });

  it("publishes robots plus paginated post/profile sitemap discovery", () => {
    const seo = read("worker/seo/public.ts");
    expect(seo).toContain('pathname === "/robots.txt"');
    expect(seo).toContain('pathname === "/sitemap.xml"');
    expect(seo).toContain("/sitemaps/posts-");
    expect(seo).toContain("/sitemaps/profiles-");
    expect(seo).toContain("Sitemap: https://srcboard.me/sitemap.xml");
  });

  it("serves privacy-aware robots and cached static sitemap responses", async () => {
    const robotsResponse = await handlePublicSeoRequest(
      new Request("https://srcboard.me/robots.txt"),
      {},
    );
    expect(robotsResponse?.status).toBe(200);
    expect(robotsResponse?.headers.get("cache-control")).toBe(
      "public, max-age=300, s-maxage=300",
    );
    const robots = await robotsResponse?.text();
    expect(robots).toContain("Disallow: /admin/");
    expect(robots).toContain("Disallow: /settings");
    expect(robots).toContain("Sitemap: https://srcboard.me/sitemap.xml");

    const staticResponse = await handlePublicSeoRequest(
      new Request("https://srcboard.me/sitemaps/static.xml"),
      {},
    );
    expect(staticResponse?.status).toBe(200);
    expect(staticResponse?.headers.get("content-type")).toContain("application/xml");
    const staticXml = await staticResponse?.text();
    expect(staticXml).toContain("https://srcboard.me/docs");
    expect(staticXml).toContain("https://srcboard.me/legal");
    expect(staticXml).not.toContain("/admin");
    expect(staticXml).not.toContain("/settings");
  });

  it("returns null for non-SEO paths and 503 when a dynamic sitemap lacks D1", async () => {
    expect(
      await handlePublicSeoRequest(new Request("https://srcboard.me/store"), {}),
    ).toBeNull();
    const dynamic = await handlePublicSeoRequest(
      new Request("https://srcboard.me/sitemap.xml"),
      {},
    );
    expect(dynamic?.status).toBe(503);
    expect(dynamic?.headers.get("cache-control")).toBe("no-store");
  });

  it("excludes every non-public or sensitive post state from sitemap SQL", () => {
    const seo = read("worker/seo/public.ts");
    expect(seo).toContain("p.visibility = 'PUBLIC'");
    expect(seo).toContain("p.deleted_at IS NULL");
    expect(seo).toContain("p.hidden_at IS NULL");
    expect(seo).toContain("p.archived_at IS NULL");
    expect(seo).toContain("p.is_nsfw = 0");
  });

  it("indexes only public active profiles and never selects private identity fields", () => {
    const seo = read("worker/seo/public.ts");
    expect(seo).toContain("up.profile_visibility = 'PUBLIC'");
    expect(seo).toContain("u.status = 'ACTIVE'");
    expect(seo).not.toContain("email_encrypted");
    expect(seo).not.toContain("email_lookup_hash");
  });

  it("marks NSFW post metadata noindex until site policy explicitly enables indexing", () => {
    const route = read("app/routes/post-detail.tsx");
    expect(route).toContain("post.isNsfw ||");
  });
});
