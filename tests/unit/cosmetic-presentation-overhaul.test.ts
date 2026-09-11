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
  });

  it("keeps theme off the uploaded cover", () => {
    const card = read("../../app/components/product/ProfileIdentityCard.tsx");
    const coverCss = read("../../app/components/product/profile-cover.css");
    const cover = jsxBlock(card, '<div className="product-profile-cover"', "</div>");
    expect(cover).toContain("product-profile-theme-photo");
    expect(cover).not.toContain("ProfileThemeLayer");
    expect(coverCss).not.toContain(".product-profile-cover .product-profile-theme-layer");
  });
});
