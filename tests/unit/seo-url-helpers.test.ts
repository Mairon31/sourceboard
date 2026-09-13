import { describe, expect, it } from "vitest";
import { hreflangLinks } from "../../shared/seo/hreflang";
import { canonicalProfileUrl, canonicalUgcUrl } from "../../shared/seo/urls";

describe("SEO URL helpers", () => {
  it("removes language/query duplication from UGC canonicals", () => {
    expect(canonicalUgcUrl("https://srcboard.me/posts/1/a?lang=es&x=1", "/posts/1/a")).toBe("https://srcboard.me/posts/1/a");
    expect(canonicalProfileUrl("a b")).toBe("https://srcboard.me/u/a%20b");
  });

  it("emits only SourceBoard hreflang variants and deterministic x-default", () => {
    expect(
      hreflangLinks(
        [
          { locale: "en", href: "/en/docs/privacy" },
          { locale: "es", href: "/es/docs/privacidad" },
        ],
        "/en/docs/privacy",
      ).map((entry) => entry.hrefLang),
    ).toEqual(["en", "es", "x-default"]);
  });
});
