import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(new URL("../../worker/search/service.ts", import.meta.url), "utf8");

describe("Discovery 2.0 search service", () => {
  it("filters posts by category as a structured predicate", () => {
    expect(service).toContain('conditions.push("p.category_slug = ?")');
    expect(service).toContain("categorySlug");
    expect(service).not.toContain("ftsQuery +=");
  });

  it("projects category slug with post results", () => {
    expect(service).toContain("p.category_slug");
    expect(service).toContain("categorySlug: row.category_slug");
  });
});
