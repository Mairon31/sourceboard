import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AVATAR_FRAME_PRESETS,
  PROFILE_BANNER_PRESETS,
  PROFILE_EFFECT_PRESETS,
  PROFILE_THEME_PRESETS,
  isAvatarFramePreset,
  isProfileBannerPreset,
  isProfileEffectPreset,
} from "../../shared/store/cosmetics";
import { AVATAR_FRAME_DEFINITIONS } from "../../app/components/product/avatar-frame-definitions";

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
  "petal-fall",
  "digital-rain",
  "aurora-particles",
  "star-drift",
  "spark-field",
  "soft-confetti",
  "energy-arcs",
  "scan-pulse",
  "glitch-ambient",
  "firefly-field",
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
  "crystal-crown",
  "comet-orbit",
  "pixel-wings",
  "fox-spirit",
  "celestial-horns",
  "floral-ring",
  "void-lens",
  "electric-halo",
] as const;

const BLOCK_E_AVATAR_FRAMES = [
  "crystal-crown",
  "comet-orbit",
  "pixel-wings",
  "fox-spirit",
  "celestial-horns",
  "floral-ring",
  "void-lens",
  "electric-halo",
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
    expect(card).toContain('import "./profile-effects-expanded.css"');
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

  it("exposes the complete Block E Profile Effect catalog", () => {
    expect(PROFILE_EFFECT_PRESETS).toHaveLength(37);
    for (const slug of NEW_PROFILE_EFFECTS) {
      expect(isProfileEffectPreset(slug)).toBe(true);
    }
  });

  it("styles every approved new Profile Effect on the card layer", () => {
    const effectCss = [
      read("../../app/components/product/profile-effects.css"),
      read("../../app/components/product/profile-effects-expanded.css"),
    ].join("\n");
    for (const slug of NEW_PROFILE_EFFECTS) {
      expect(effectCss).toContain(`.product-profile-effect-layer--${slug}`);
    }
  });

  it("accepts the complete Block E Avatar Frame catalog", () => {
    expect(AVATAR_FRAME_PRESETS).toHaveLength(43);
    for (const slug of NEW_AVATAR_FRAMES) {
      expect(isAvatarFramePreset(slug)).toBe(true);
      expect(AVATAR_FRAME_DEFINITIONS[slug]).toBeDefined();
      expect(AVATAR_FRAME_DEFINITIONS[slug].parts.length).toBeGreaterThan(0);
    }
  });

  it("keeps Avatar Frame visuals isolated inside the canonical Avatar Stage", () => {
    const legacyFrameCss = read("../../app/components/product/avatar-frames.css");
    const stageCss = read("../../app/components/product/avatar-stage.css");
    const identity = read("../../app/components/product/CosmeticIdentity.tsx");
    const stage = read("../../app/components/product/AvatarStage.tsx");
    const definitions = read("../../app/components/product/avatar-frame-definitions.ts");
    expect(identity).toContain("<AvatarStage");
    expect(stage).toContain("AVATAR_FRAME_DEFINITIONS");
    expect(stage).toContain("product-avatar-stage__part");
    expect(definitions).toContain("AVATAR_STAGE_LAYER_ORDER");
    expect(legacyFrameCss).not.toContain(".product-profile-effect-layer");
    expect(stageCss).not.toContain(".product-profile-effect-layer");
    expect(legacyFrameCss).not.toContain(".product-profile-card-surface");
    expect(stageCss).not.toContain(".product-profile-card-surface");
    for (const slug of BLOCK_E_AVATAR_FRAMES.filter((slug) => slug !== "fox-spirit")) {
      expect(stageCss).toContain(`[data-avatar-frame="${slug}"]`);
    }
    expect(AVATAR_FRAME_DEFINITIONS["fox-spirit"].parts.length).toBeGreaterThan(0);
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

  it("bounds decorative motion and keeps a visible reduced-motion fallback", () => {
    const effectComponent = read("../../app/components/product/ProfileEffectLayer.tsx");
    const effectCss = read("../../app/components/product/profile-effects.css");
    const expandedEffectCss = read("../../app/components/product/profile-effects-expanded.css");
    const frameCss = read("../../app/components/product/avatar-frames.css");
    const stageCss = read("../../app/components/product/avatar-stage.css");
    const cardCss = read("../../app/components/product/profile-identity-card.css");

    expect(effectComponent).toContain("[0, 1, 2, 3, 4, 5]");
    expect(effectCss).toContain("pointer-events: none");
    expect(effectCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(expandedEffectCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(frameCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stageCss).toContain("@media (prefers-reduced-motion: reduce)");
    for (const token of ["setInterval", "setTimeout", "requestAnimationFrame"]) {
      expect(effectComponent).not.toContain(token);
    }

    expect(cardCss).toContain("overflow: hidden");
    expect(cardCss).toContain("isolation: isolate");
    const reducedMotion = effectCss.slice(
      effectCss.lastIndexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reducedMotion).toContain(".product-profile-effect-layer::before");
    expect(reducedMotion).toContain(".product-profile-effect-layer::after");
    expect(reducedMotion).toContain(".product-profile-effect-layer__node::before");
    expect(reducedMotion).toContain(".product-profile-effect-layer__node::after");
    expect(reducedMotion).toMatch(
      /\.product-profile-effect-layer__node\s*\{[^}]*opacity:\s*(?:0\.[1-9]\d*|1(?:\.0+)?)\s*!important;/s,
    );

    const reducedFrameMotion = frameCss.slice(
      frameCss.lastIndexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reducedFrameMotion).toContain(".product-avatar-frame--decorative::before");
    expect(reducedFrameMotion).toContain(".product-avatar-frame--decorative::after");
  });

  it("preserves legacy cosmetic preset compatibility", () => {
    expect(PROFILE_BANNER_PRESETS).toBe(PROFILE_THEME_PRESETS);
    expect(isProfileBannerPreset("nebula")).toBe(true);
    expect(isProfileEffectPreset("star-dust")).toBe(true);
    expect(isAvatarFramePreset("cat-ears")).toBe(true);
  });

  it("keeps card-wide effects out of compact feed, comment and navigation identity", () => {
    for (const path of [
      "../../app/components/product/PostCard.tsx",
      "../../app/components/product/CommentThread.tsx",
      "../../app/components/product/NotificationActorStack.tsx",
    ]) {
      const source = read(path);
      expect(source).toContain("CosmeticIdentity");
      expect(source).toContain('mode="compact"');
      expect(source).not.toContain("ProfileEffectLayer");
    }
  });
});
