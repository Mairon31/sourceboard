import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AVATAR_FRAME_DEFINITIONS } from "../../app/components/product/avatar-frame-definitions";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");

const LEGACY_FRAMES = [
  "nebula",
  "stellar",
  "emerald",
  "rainbow",
  "eclipse",
  "ocean",
  "nova",
  "cyber",
  "gold",
  "shadow",
  "sakura",
  "inferno",
  "crystal",
  "holographic",
  "fire",
  "ice",
  "electric",
] as const;

describe("Store cosmetic rendering regressions", () => {
  it("does not activate the legacy Store-wide profile effect renderer", () => {
    const store = read("../../app/components/product/StoreItemCard.tsx");
    expect(store).not.toContain('item.type === "PROFILE_BANNER" ? "theme" : "effect"');
    expect(store).toContain('item.type === "PROFILE_BANNER" ? "theme" : "profile-effect"');
  });

  it("keeps Store cosmetic previews visible despite ProfileIdentityCard min-height", () => {
    const css = read("../../app/components/product/profile-cosmetic-preview.css");
    expect(css).toMatch(
      /\.product-store-preview\.product-cosmetic-preview\s*\{[^}]*min-height:\s*190px/s,
    );
    expect(css).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.product-store-preview\.product-cosmetic-preview\s*\{[^}]*min-height:\s*150px/s,
    );
  });

  it("keeps Store avatar sizing owned by AvatarStage at desktop and mobile widths", () => {
    const css = read("../../app/components/product/profile-cosmetic-preview.css");
    expect(css).toContain("--avatar-stage-size: 104px");
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*--avatar-stage-size:\s*82px/);
  });

  it("makes the canonical AvatarStage own the avatar box on every surface", () => {
    const stage = read("../../app/components/product/avatar-stage.css");
    const store = read("../../app/components/product/store.css");
    const preview = read("../../app/components/product/profile-cosmetic-preview.css");

    expect(stage).toMatch(
      /\.product-avatar-stage__avatar\s+\.sb-avatar\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;/,
    );
    expect(stage).toMatch(
      /\.product-avatar-stage__part\[data-layer="inner-ring"\]\s*\{[\s\S]*z-index:\s*4;[\s\S]*inset:\s*0;/,
    );
    expect(stage).toMatch(
      /\.product-avatar-stage__part\[data-layer="outer-ring"\],[\s\S]*\.product-avatar-stage__part\[data-layer="orbit"\]\s*\{[\s\S]*inset:\s*0;/,
    );
    expect(store).not.toMatch(/\.product-store-preview\s+\.sb-avatar\s*\{/);
    expect(preview).not.toMatch(/\.product-avatar-stage\[data-size="preview"\]\s+\.sb-avatar\s*\{/);
  });

  it("gives every legacy frame an explicit non-fallback geometry definition", () => {
    const signatures = LEGACY_FRAMES.map((preset) => {
      const definition = AVATAR_FRAME_DEFINITIONS[preset];
      expect(definition.parts.length).toBeGreaterThan(0);
      return JSON.stringify(definition.parts.map((part) => part.geometry));
    });

    expect(new Set(signatures).size).toBe(LEGACY_FRAMES.length);
  });

  it("gives profile effects a visible static mechanism backdrop before animation starts", () => {
    const layer = read("../../app/components/product/ProfileEffectLayer.tsx");
    const css = read("../../app/components/product/profile-effects.css");

    expect(layer).toContain("data-effect-mechanism");
    for (const mechanism of [
      "glow",
      "grain",
      "particles",
      "energy",
      "smoke",
      "snow",
      "rain",
      "scan",
      "glitch",
      "mist",
      "confetti",
      "arc",
    ]) {
      expect(css).toContain(`[data-effect-mechanism="${mechanism}"]::before`);
    }
  });

  it("does not double-render structural avatar frames with legacy pseudo-elements", () => {
    const css = read("../../app/components/product/avatar-frames.css");
    for (const preset of [
      "cat-ears",
      "cat-ears-black",
      "cat-ears-white",
      "fox-ears",
      "wings",
      "cyber-wings",
      "devil-horns",
      "angel-halo",
      "crown",
      "orbit-planets",
      "black-hole",
    ]) {
      expect(css).not.toContain(`data-avatar-frame="${preset}"]::before`);
      expect(css).not.toContain(`data-avatar-frame="${preset}"]::after`);
    }
  });

  it("keeps migrated frame decoration outside the inner avatar element", () => {
    const css = read("../../app/components/product/avatar-frames.css");
    for (const preset of ["holographic", "fire", "ice", "electric"]) {
      expect(css).not.toContain(`.sb-avatar--frame-${preset}`);
    }
  });

  it("uses AvatarStage geometry for halo and wing silhouettes", () => {
    const css = read("../../app/components/product/avatar-stage.css");
    expect(css).toContain('data-avatar-frame="angel-halo"');
    expect(css).toContain('data-avatar-frame="cyber-wings"');
    expect(css).toMatch(/data-avatar-frame="angel-halo"[\s\S]*border-radius:\s*50%/);
    expect(css).toMatch(/data-avatar-frame="cyber-wings"[\s\S]*clip-path:/);
  });
});
