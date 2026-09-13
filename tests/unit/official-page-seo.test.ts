import { describe, expect, it } from "vitest";
import { officialPageMeta } from "../../shared/seo/official-pages";

describe("official page SEO", () => {
  it("advertises only genuine published locale variants", () => {
    const meta = officialPageMeta({
      locale: "fr",
      page: {
        pageId: "privacy",
        variants: [
          { locale: "en", path: "/en/legal/privacy", title: "Privacy", description: "Privacy policy" },
          { locale: "es", path: "/es/legal/privacidad", title: "Privacidad", description: "Política de privacidad" },
        ],
      },
    });
    const alternates = meta.filter((entry) => "hrefLang" in entry).map((entry) => (entry as { hrefLang: string }).hrefLang);
    expect(alternates).toContain("en");
    expect(alternates).toContain("es");
    expect(alternates).not.toContain("fr");
  });
});
