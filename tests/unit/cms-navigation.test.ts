import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CMS navigation", () => {
  it("keeps content and placement tables separate and normalizes reorder scope", () => {
    const source = readFileSync(new URL("../../worker/cms/navigation.ts", import.meta.url), "utf8");
    expect(source).toContain("cms_navigation_items");
    expect(source).toContain("cms_page_locale_state");
    expect(source).toContain("orderedIds.map((id, sortOrder)");
    expect(source).not.toContain("DELETE FROM cms_pages");
  });
});
