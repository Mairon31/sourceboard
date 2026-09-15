import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeCmsSlug } from "../../worker/cms/slugs";

const cmsServiceSource = readFileSync(
  new URL("../../worker/cms/service.ts", import.meta.url),
  "utf8",
);

describe("CMS service contracts", () => {
  it("normalizes bounded locale routes without traversal", () => {
    expect(normalizeCmsSlug(" Privacy Policy ")).toBe("privacy-policy");
    expect(normalizeCmsSlug("Guía de Uso")).toBe("guía-de-uso");
    expect(() => normalizeCmsSlug("..")).toThrow("CMS_SLUG_INVALID");
  });

  it("keeps slugs bounded", () => {
    expect(normalizeCmsSlug("a".repeat(180))).toHaveLength(96);
  });

  it("uses a D1-compatible VALUES locale matrix instead of a compound SELECT", () => {
    expect(cmsServiceSource).toContain(
      "FROM (VALUES ('en'), ('es'), ('pt'), ('fr'), ('ru'), ('de')) l",
    );
    expect(cmsServiceSource).not.toContain("UNION ALL SELECT 'es'");
  });
});

