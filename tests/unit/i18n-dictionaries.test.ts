import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "../../shared/i18n/locales";
import { allMessages, translate, translatePlural } from "../../app/i18n";
import { enMessages } from "../../app/i18n/messages/en";

describe("i18n dictionaries", () => {
  it("keeps every locale complete and non-empty", () => {
    const englishKeys = Object.keys(enMessages).sort();
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(allMessages[locale]).sort(), locale).toEqual(englishKeys);
      for (const value of Object.values(allMessages[locale])) expect(value.trim()).not.toBe("");
    }
  });

  it("interpolates plain text and pluralizes", () => {
    expect(translate("es", "settings.security.title")).toBe("Seguridad");
    expect(translatePlural("en", "comments.summary", 1)).toBe("1 comment");
    expect(translatePlural("en", "comments.summary", 2)).toBe("2 comments");
  });
});
