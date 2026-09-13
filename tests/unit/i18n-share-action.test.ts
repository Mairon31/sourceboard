import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shareAction = readFileSync("app/components/product/ShareAction.tsx", "utf8");
const i18nIndex = readFileSync("app/i18n/index.ts", "utf8");

describe("ShareAction internationalization", () => {
  it("routes share chrome through the global i18n layer", () => {
    expect(shareAction).toContain("useI18n");
    expect(shareAction).toContain('t("share.action")');
    expect(shareAction).toContain('t("share.copied")');
    expect(shareAction).toContain('t("share.unavailable")');
    expect(shareAction).not.toContain('aria-label="Share"');
    expect(shareAction).not.toContain('"Unable to share."');
  });

  it("uses the canonical locale allowlist instead of a duplicate local set", () => {
    expect(shareAction).toContain("isLocale");
    expect(shareAction).not.toContain("const SHARE_LOCALES");
  });

  it("registers localized share messages in the typed i18n catalog", () => {
    expect(i18nIndex).toContain("commonMessageSets");
    expect(i18nIndex).toContain("CommonMessageKey");
  });
});
