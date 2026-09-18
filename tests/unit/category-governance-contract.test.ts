import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("category governance contract", () => {
  it("keeps category administration capability-scoped and localized", () => {
    const route = read("app/routes/admin-categories.tsx");
    const api = read("worker/categories/api.ts");
    const shell = read("app/components/admin/AdminShell.tsx");
    expect(route).toContain('hasCapability(admin.authorization, "content.manage")');
    expect(api).toContain('hasCapability(authorization, "content.manage")');
    expect(route).toContain("SUPPORTED_LOCALES.map");
    expect(shell).toContain('"admin.categories.nav"');
  });

  it("preserves flags in the schema and excludes noindex categories from SEO", () => {
    const migration = read("migrations/0039_post_categories.sql");
    const seo = read("worker/seo/public.ts");
    expect(migration).toContain("is_nsfw");
    expect(migration).toContain("is_archived");
    expect(migration).toContain("noindex");
    expect(seo).toContain("filter((category) => !category.noindex)");
  });
});
