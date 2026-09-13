import { describe, expect, it } from "vitest";
import { localizedHref, stripLangForCanonical, switchLocaleHref, withLangQuery } from "../../app/i18n/routes";

describe("i18n routes", () => {
  it("builds localized official routes", () => {
    expect(localizedHref("es", "store")).toBe("/es/store");
    expect(localizedHref("fr", "docs", "privacy")).toBe("/fr/docs/privacy");
  });

  it("keeps UGC structural and strips language from canonicals", () => {
    expect(withLangQuery("/u/alice", "de")).toBe("/u/alice?lang=de");
    expect(stripLangForCanonical("https://srcboard.me/posts/1/a?lang=ru")).toBe("https://srcboard.me/posts/1/a");
    expect(switchLocaleHref("/u/alice", "", "es")).toBe("/u/alice?lang=es");
  });

  it("switches official paths to locale prefixes", () => {
    expect(switchLocaleHref("/store", "", "de")).toBe("/de/store");
    expect(switchLocaleHref("/es/docs/privacy", "", "fr")).toBe("/fr/docs/privacy");
  });
});
