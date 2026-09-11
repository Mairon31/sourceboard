import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AVATAR_FRAME_PRESETS,
  PROFILE_EFFECT_PRESETS,
  isAvatarFramePreset,
  isProfileEffectPreset,
} from "../../shared/store/cosmetics";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");

function jsxBlock(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  return start >= 0 && end > start ? source.slice(start, end) : "";
}

const NEW_PROFILE_EFFECTS = [
  "falling-stars",
  "cherry-blossom",
  "neon-rain",
  "matrix-rain",
  "pixel-spark",
  "cosmic-rift",
  "ocean-bubbles",
  "ghost-flames",
  "confetti",
  "love-letter",
  "meteor-shower",
  "digital-scan",
] as const;

const NEW_AVATAR_FRAMES = [
  "glitch-ring",
  "neko-neon",
  "pixel-glitch",
  "devil-horns",
  "angel-halo",
  "cyber-wings",
  "crown",
  "electric-coils",
  "orbit-planets",
  "sakura-petals",
  "black-hole",
  "slime",
  "retro-arcade",
  "cat-ears-black",
  "cat-ears-white",
  "fox-ears",
] as const;

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

  it("renders every legacy effect through the dedicated card effect stylesheet", () => {
    const effectPath = resolve(
      import.meta.dirname,
      "../../app/components/product/profile-effects.css",
    );
    expect(existsSync(effectPath)).toBe(true);
    if (!existsSync(effectPath)) return;

    const effectCss = read("../../app/components/product/profile-effects.css");
    const cardCss = read("../../app/components/product/profile-identity-card.css");
    const card = read("../../app/components/product/ProfileIdentityCard.tsx");
    for (const slug of [
      "soft-glow",
      "paper-grain",
      "star-dust",
      "blue-energy",
      "fire-pulse",
      "pink-hearts",
      "dark-smoke",
      "snow-drift",
      "electric-burst",
      "holy-glow",
      "butterfly",
      "rgb-glitch",
      "moon-mist",
      "leaf-drift",
    ]) {
      expect(effectCss).toContain(`.product-profile-effect-layer--${slug}`);
      expect(cardCss).not.toContain(`.product-profile-effect-layer--${slug}`);
    }
    expect(card).toContain('import "./profile-effects.css"');
  });

  it("exposes exactly 27 Profile Effect choices", () => {
    expect(PROFILE_EFFECT_PRESETS).toHaveLength(27);
    for (const slug of NEW_PROFILE_EFFECTS) {
      expect(isProfileEffectPreset(slug)).toBe(true);
    }
  });

  it("styles every approved new Profile Effect on the card layer", () => {
    const effectCss = read("../../app/components/product/profile-effects.css");
    for (const slug of NEW_PROFILE_EFFECTS) {
      expect(effectCss).toContain(`.product-profile-effect-layer--${slug}`);
    }
  });

  it("accepts all approved Avatar Frames", () => {
    expect(AVATAR_FRAME_PRESETS).toHaveLength(35);
    for (const slug of NEW_AVATAR_FRAMES) {
      expect(isAvatarFramePreset(slug)).toBe(true);
    }
  });

  it("keeps structural Avatar Frame visuals isolated from card-wide cosmetic layers", () => {
    const framePath = resolve(
      import.meta.dirname,
      "../../app/components/product/avatar-frames.css",
    );
    expect(existsSync(framePath)).toBe(true);
    if (!existsSync(framePath)) return;

    const frameCss = read("../../app/components/product/avatar-frames.css");
    const identity = read("../../app/components/product/CosmeticIdentity.tsx");
    expect(identity).toContain('import "./avatar-frames.css"');
    expect(identity).toContain("STRUCTURAL_AVATAR_FRAMES");
    expect(identity).toContain("STRUCTURAL_AVATAR_FRAMES.has(avatarFrame)");
    expect(frameCss).not.toContain(".product-profile-effect-layer");
    expect(frameCss).not.toContain(".product-profile-card-surface");
    for (const slug of NEW_AVATAR_FRAMES) {
      expect(frameCss).toContain(`[data-avatar-frame="${slug}"]`);
    }
  });

  it("routes profile cosmetic preview surfaces through one shared renderer", () => {
    for (const path of [
      "../../app/components/product/StoreItemCard.tsx",
      "../../app/components/admin/store/AdminPresetLaboratory.tsx",
      "../../app/components/admin/store/AdminCosmeticGuide.tsx",
      "../../app/components/product/CommunityCosmeticStudio.tsx",
    ]) {
      expect(read(path)).toContain("ProfileCosmeticPreview");
    }
    const store = read("../../app/components/product/StoreItemCard.tsx");
    expect(store).not.toContain('<div className="product-profile-theme-layer"');
    expect(store).not.toContain("product-store-preview--${config.preset");
  });

  it("validates shared preview presets through the canonical registries", () => {
    const preview = read("../../app/components/product/ProfileCosmeticPreview.tsx");
    expect(preview).toContain("isProfileThemePreset");
    expect(preview).toContain("isProfileEffectPreset");
    expect(preview).toContain("isAvatarFramePreset");
  });
});
