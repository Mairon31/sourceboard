import { describe, expect, it } from "vitest";
import { formatNumber } from "../../app/i18n";
import { messageNamespaces } from "../../app/i18n/messages/catalog";
import { SUPPORTED_LOCALES } from "../../shared/i18n/locales";

describe("i18n catalog architecture", () => {
  it("organizes every supported locale by the same product namespaces", () => {
    const namespaces = [
      "base",
      "common",
      "editing",
      "product",
      "settings",
      "social",
      "store",
    ] as const;

    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(messageNamespaces[locale]).sort()).toEqual(namespaces);
      for (const namespace of namespaces) {
        expect(Object.keys(messageNamespaces[locale][namespace]).length).toBeGreaterThan(0);
      }
    }
  });

  it("formats numbers with the selected locale rather than an English-only formatter", () => {
    expect(formatNumber("en", 12345.6)).not.toBe(formatNumber("de", 12345.6));
  });
});
