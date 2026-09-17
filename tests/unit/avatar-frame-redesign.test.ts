import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AVATAR_FRAME_DEFINITIONS,
  AVATAR_STAGE_LAYER_ORDER,
} from "../../app/components/product/avatar-frame-definitions";
import { AVATAR_FRAME_PRESETS, isAvatarFramePreset } from "../../shared/store/cosmetics";
import { sanitizeCommunityCosmeticCss } from "../../shared/store/community-css";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");

const PDF_INSPIRED_FRAMES = [
  ["orange", 300],
  ["yellow", 300],
  ["lime", 300],
  ["binary", 500],
  ["emerald-dotted", 650],
  ["double", 750],
  ["neon-light", 900],
  ["extreme-ice", 900],
  ["neon-green", 1000],
  ["lux-star", 1100],
  ["double-grid", 1300],
  ["lime-curve", 1400],
  ["ruby-double", 1600],
  ["crimson-cursed", 2000],
  ["fire-tips", 2400],
  ["vx", 3000],
] as const;

const BASIC_COLOR_FRAMES = [
  "simple-blue",
  "cyan",
  "purple",
  "pink",
  "green",
  "red",
  "gold",
  "white",
  "dark",
  "pastel",
  "double-blue",
  "thin-neon",
] as const;

describe("avatar frame recolor and preset catalog", () => {
  it("registers the PDF-inspired frame families on the canonical AvatarStage", () => {
    for (const [preset] of PDF_INSPIRED_FRAMES) {
      expect(isAvatarFramePreset(preset)).toBe(true);
      const definition = AVATAR_FRAME_DEFINITIONS[preset];
      expect(definition.parts.length).toBeGreaterThan(0);
      expect(
        definition.parts.every((part) => AVATAR_STAGE_LAYER_ORDER.includes(part.geometry.layer)),
      ).toBe(true);
    }
    expect(AVATAR_FRAME_PRESETS).toHaveLength(70);
  });

  it("keeps the basic recolors visibly thicker than the legacy hairline", () => {
    const css = read("../../app/components/product/avatar-stage.css");
    expect(css).toContain("--avatar-frame-width");
    expect(css).toContain("--avatar-frame-width: 4px");
    for (const preset of BASIC_COLOR_FRAMES) {
      expect(css).toContain(`data-avatar-frame="${preset}"`);
    }
  });

  it("seeds the new frame rows without changing existing ownership data", () => {
    const catalog = read("../../worker/store/builtin-catalog.ts");
    expect(catalog).toContain('const BUILTIN_STORE_VERSION = "2026-09-17-cosmetics-v5"');
    expect(catalog).not.toContain("UPDATE user_inventory");
    expect(catalog).not.toContain("UPDATE user_cosmetics");
    for (const [preset, price] of PDF_INSPIRED_FRAMES) {
      expect(catalog).toContain(`'store-frame-${preset}'`);
      expect(catalog).toContain(`, ${price}, '{"preset":"${preset}"}'`);
    }
  });

  it("accepts only bounded avatar-stage CSS for admin frame customization", () => {
    const result = sanitizeCommunityCosmeticCss(
      ".cosmetic-root .profile-avatar-area .product-avatar-stage__part { border-width: 4px; border-color: #ff0000; }",
      "store-frame-red",
    );
    expect(result.scopedCss).toContain(
      '[data-community-cosmetic~="store-frame-red"] .profile-avatar-area',
    );
    const directStage = sanitizeCommunityCosmeticCss(
      ".cosmetic-root .product-avatar-stage__part { border-color: #00ff88; }",
      "store-frame-red",
    );
    expect(directStage.scopedCss).toContain(
      ".product-avatar-stage__part:not(#sbcc-store-frame-red)",
    );
    expect(() => sanitizeCommunityCosmeticCss("body { color: red; }", "store-frame-red")).toThrow();
  });

  it("exposes preset and sanitized CSS editing in the admin cosmetic editor", () => {
    const editor = read("../../app/components/admin/store/CosmeticConfigEditor.tsx");
    const storeEditor = read("../../app/components/admin/store/AdminStoreEditor.tsx");
    expect(editor).toContain("framePreset");
    expect(editor).toContain("customCss");
    expect(editor).toContain("sanitizeCommunityCosmeticCss");
    expect(storeEditor).toContain("communityCssSource");
    expect(storeEditor).toContain("sanitizeCommunityCosmeticCss");
    expect(storeEditor).toContain("setFramePreset");
  });

  it("carries configured frame CSS into the public Store preview", () => {
    const store = read("../../app/components/product/StoreItemCard.tsx");
    const route = read("../../app/routes/store.tsx");
    expect(route).toContain("communityStyles");
    expect(store).toContain("config.communityStyles");
  });
});
