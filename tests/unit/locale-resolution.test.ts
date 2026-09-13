import { describe, expect, it } from "vitest";
import {
  localeCookie,
  parseAcceptLanguage,
  readLocaleCookie,
  resolveLocale,
} from "../../app/data/locale.server";

describe("locale resolution", () => {
  it("supports regional browser languages and quality weights", () => {
    expect(parseAcceptLanguage("es-CR,es;q=0.9,en;q=0.8")).toBe("es");
    expect(parseAcceptLanguage("xx;q=1,de-DE;q=0.8,fr;q=0.7")).toBe("de");
  });

  it("uses explicit, cookie, account, browser, English precedence", () => {
    expect(resolveLocale({ explicitLang: "fr", cookieLocale: "de" })).toBe("fr");
    expect(resolveLocale({ cookieLocale: "de", accountLocale: "es", acceptLanguage: "ru" })).toBe("de");
    expect(resolveLocale({ accountLocale: "pt", acceptLanguage: "ru" })).toBe("pt");
    expect(resolveLocale({ explicitLang: "xx", acceptLanguage: "ru" })).toBe("ru");
    expect(resolveLocale({})).toBe("en");
  });

  it("keeps short links English unless lang is explicit", () => {
    expect(resolveLocale({ cookieLocale: "es", shortLinkDefaultEnglish: true })).toBe("en");
    expect(resolveLocale({ explicitLang: "de", cookieLocale: "es", shortLinkDefaultEnglish: true })).toBe("de");
  });

  it("round-trips the allowlisted locale cookie", () => {
    const value = localeCookie("es", true);
    expect(value).toContain("sourceboard_locale=es");
    expect(value).toContain("SameSite=Lax");
    expect(value).toContain("Secure");
    expect(readLocaleCookie(value)).toBe("es");
  });
});
