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
});
