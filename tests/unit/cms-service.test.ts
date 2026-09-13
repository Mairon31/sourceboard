import { describe, expect, it } from "vitest";
import { normalizeCmsSlug } from "../../worker/cms/slugs";

describe("CMS service contracts", () => {
  it("normalizes bounded locale routes without traversal", () => {
    expect(normalizeCmsSlug(" Privacy Policy ")).toBe("privacy-policy");
    expect(normalizeCmsSlug("Guía de Uso")).toBe("guía-de-uso");
    expect(() => normalizeCmsSlug("..")).toThrow("CMS_SLUG_INVALID");
  });

  it("keeps slugs bounded", () => {
    expect(normalizeCmsSlug("a".repeat(180))).toHaveLength(96);
  });
});
