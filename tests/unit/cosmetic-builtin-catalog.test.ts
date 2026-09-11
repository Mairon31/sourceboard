import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const catalog = readFileSync(
  resolve(import.meta.dirname, "../../worker/store/builtin-catalog.ts"),
  "utf8",
);

const NEW_PROFILE_EFFECTS = [
  ["falling-stars", 3600],
  ["cherry-blossom", 3800],
  ["neon-rain", 4200],
  ["matrix-rain", 4500],
  ["pixel-spark", 3000],
  ["cosmic-rift", 7000],
  ["ocean-bubbles", 2800],
  ["ghost-flames", 5200],
  ["confetti", 2600],
  ["love-letter", 3200],
  ["meteor-shower", 6200],
  ["digital-scan", 4000],
] as const;

const NEW_AVATAR_FRAMES = [
  ["glitch-ring", 4800],
  ["neko-neon", 5200],
  ["pixel-glitch", 4000],
  ["devil-horns", 5000],
  ["angel-halo", 5400],
  ["cyber-wings", 6500],
  ["crown", 7000],
  ["electric-coils", 6200],
  ["orbit-planets", 7500],
  ["sakura-petals", 4600],
  ["black-hole", 9000],
  ["slime", 3000],
  ["retro-arcade", 4200],
  ["cat-ears-black", 3400],
  ["cat-ears-white", 3400],
  ["fox-ears", 3800],
] as const;

describe("Cosmetic built-in catalog", () => {
  it("uses the approved cosmetics v3 seed version", () => {
    expect(catalog).toContain('const BUILTIN_STORE_VERSION = "2026-09-10-cosmetics-v3"');
    expect(catalog).toContain("INSERT OR IGNORE INTO store_items");
  });

  it("seeds every new Profile Effect with stable id, preset, and price", () => {
    for (const [slug, price] of NEW_PROFILE_EFFECTS) {
      expect(catalog).toContain(`'store-effect-${slug}'`);
      expect(catalog).toContain(`'{"preset":"${slug}"}'`);
      expect(catalog).toContain(`, ${price}, '{"preset":"${slug}"}'`);
    }
  });

  it("seeds every new Avatar Frame with stable id, preset, and price", () => {
    for (const [slug, price] of NEW_AVATAR_FRAMES) {
      expect(catalog).toContain(`'store-frame-${slug}'`);
      expect(catalog).toContain(`'{"preset":"${slug}"}'`);
      expect(catalog).toContain(`, ${price}, '{"preset":"${slug}"}'`);
    }
  });

  it("does not mutate ownership, purchases, or equipped cosmetics while seeding", () => {
    expect(catalog).not.toContain("UPDATE user_inventory");
    expect(catalog).not.toContain("UPDATE store_purchases");
    expect(catalog).not.toContain("UPDATE user_cosmetics");
  });
});
