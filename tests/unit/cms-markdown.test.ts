import { describe, expect, it } from "vitest";
import { normalizeCmsMarkdown } from "../../worker/cms/markdown";

describe("CMS Markdown", () => {
  it("keeps safe headings, lists, code and links", () => {
    const value = "## Heading\n\n- item\n\n[Source](https://srcboard.me)\n\n`code`";
    expect(normalizeCmsMarkdown(value)).toBe(value);
  });

  it("rejects raw HTML, images and unsafe protocols", () => {
    expect(() => normalizeCmsMarkdown("<script>alert(1)</script>")).toThrow("CMS_RAW_HTML_FORBIDDEN");
    expect(() => normalizeCmsMarkdown("![x](https://example.com/a.png)")).toThrow("CMS_IMAGES_FORBIDDEN");
    expect(() => normalizeCmsMarkdown("[x](javascript:alert(1))")).toThrow("CMS_LINK_INVALID");
  });
});
