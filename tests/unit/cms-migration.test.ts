import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CMS migration", () => {
  const sql = readFileSync(new URL("../../migrations/0033_cms_content.sql", import.meta.url), "utf8");

  it("defines immutable revisions, publication routes and navigation separately", () => {
    for (const table of ["cms_pages", "cms_page_revisions", "cms_page_locale_state", "cms_page_routes", "cms_navigation_items", "cms_navigation_labels"]) {
      expect(sql).toContain(`CREATE TABLE ${table}`);
    }
    expect(sql).toContain("UNIQUE(page_id, locale, version)");
    expect(sql).toContain("cms_page_routes_current_unique");
    expect(sql).toContain("UNIQUE(page_id, surface)");
  });

  it("adds content.manage to Admin and Owner", () => {
    expect(sql).toContain("content.manage");
    expect(sql).toContain("slug IN ('owner', 'admin')");
  });
});
