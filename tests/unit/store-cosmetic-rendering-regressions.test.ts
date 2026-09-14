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

  it("gives every legacy frame an explicit non-fallback geometry definition", () => {
    const signatures = LEGACY_FRAMES.map((preset) => {
      const definition = AVATAR_FRAME_DEFINITIONS[preset];
      expect(definition.parts.length).toBeGreaterThan(0);
      return JSON.stringify(definition.parts.map((part) => part.geometry));
    });

    expect(new Set(signatures).size).toBe(LEGACY_FRAMES.length);
  });
});
