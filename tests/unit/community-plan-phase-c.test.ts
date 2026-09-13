import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

describe("community plan phase C profile cosmetics", () => {
  it("uses Profile Theme as the canonical public concept while preserving legacy compatibility", () => {
    const cosmetics = read("../../shared/store/cosmetics.ts");
    const profileTypes = read("../../worker/profile/types.ts");
    const store = read("../../app/routes/store.tsx");
    expect(cosmetics).toContain("PROFILE_THEME_PRESETS");
    expect(cosmetics).toContain("ProfileThemePreset");
    expect(profileTypes).toContain("profileTheme");
    expect(store).toContain('label: "store.filter.profileThemes"');
    expect(store).not.toContain('label: "store.filter.banner"');
  });

  it("renders theme and effect through one ProfileIdentityCard for own and public profile", () => {
    const card = read("../../app/components/product/ProfileIdentityCard.tsx");
    const hero = read("../../app/components/product/ProfileHero.tsx");
    const editor = read("../../app/components/product/ProfileEditor.tsx");
    expect(card).toContain("data-profile-theme");
    expect(card).toContain("profileEffect");
    expect(card).toContain("<ProfileThemeLayer");
    expect(card).toContain("<ProfileEffectLayer");
    expect(hero).toContain("ProfileIdentityCard");
    expect(editor).toContain("ProfileIdentityCard");
  });

  it("expands frames and fonts into the requested style families", () => {
    const cosmetics = read("../../shared/store/cosmetics.ts");
    for (const preset of [
      "holographic",
      "fire",
      "ice",
      "electric",
      "sakura",
      "cat-ears",
      "wings",
    ]) {
      expect(cosmetics).toContain(`"${preset}"`);
    }
    for (const font of [
      "Manrope",
      "DM Sans",
      "Urbanist",
      "Anton",
      "League Spartan",
      "Fredoka",
      "Playfair Display",
      "Cormorant Garamond",
    ]) {
      expect(cosmetics).toContain(`"${font}"`);
    }
  });

  it("keeps profile effects and structural frames scoped with reduced motion", () => {
    const cardCss = read("../../app/components/product/profile-identity-card.css");
    const effectCss = read("../../app/components/product/profile-effects.css");
    const frameCss = read("../../app/components/product/avatar-frames.css");
    expect(cardCss).toContain("product-profile-effect-layer");
    expect(effectCss).toContain("prefers-reduced-motion: reduce");
    expect(frameCss).toContain("prefers-reduced-motion: reduce");
    expect(frameCss).toContain("product-avatar-frame--decorative");
  });
});
