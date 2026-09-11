import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");

function jsxBlock(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  return start >= 0 && end > start ? source.slice(start, end) : "";
}

describe("Cosmetic presentation overhaul", () => {
  it("keeps profile effects out of avatar and name identity", () => {
    const identity = read("../../app/components/product/CosmeticIdentity.tsx");
    expect(identity).not.toContain("profileEffect");
    expect(identity).not.toContain("cosmetic-identity--effect-");
  });

  it("introduces separate theme and effect renderers", () => {
    expect(read("../../app/components/product/ProfileThemeLayer.tsx")).toContain(
      "data-profile-theme",
    );
    expect(read("../../app/components/product/ProfileEffectLayer.tsx")).toContain(
      "data-profile-effect",
    );
  });

  it("composes profile theme and effect layers at the profile card boundary", () => {
    const card = read("../../app/components/product/ProfileIdentityCard.tsx");
    expect(card).toContain("<ProfileThemeLayer");
    expect(card).toContain("<ProfileEffectLayer");
    expect(card).toContain('import "./profile-themes.css"');
  });

  it("keeps theme off the uploaded cover", () => {
    const card = read("../../app/components/product/ProfileIdentityCard.tsx");
    const coverCss = read("../../app/components/product/profile-cover.css");
    const cover = jsxBlock(card, '<div className="product-profile-cover"', "</div>");
    expect(cover).toContain("product-profile-theme-photo");
    expect(cover).not.toContain("ProfileThemeLayer");
    expect(coverCss).not.toContain(".product-profile-cover .product-profile-theme-layer");
  });

  it("keeps all stable profile themes on the dedicated card layer", () => {
    const themeCss = read("../../app/components/product/profile-themes.css");
    const cardCss = read("../../app/components/product/profile-identity-card.css");
    for (const slug of [
      "nebula",
      "aurora",
      "ember",
      "ocean-glass",
      "sunset-noir",
      "prism-grid",
      "forest-ink",
      "silver-wave",
      "cosmic-dusk",
      "terminal-grid",
      "sakura-night",
      "golden-hour",
    ]) {
      expect(themeCss).toContain(`data-profile-theme="${slug}"`);
    }
    expect(cardCss).not.toContain('data-profile-theme="');
  });
});
