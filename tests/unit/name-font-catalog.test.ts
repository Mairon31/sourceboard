import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const catalog = read("../../worker/store/builtin-catalog.ts");
const cosmetics = read("../../shared/store/cosmetics.ts");
const fontProviders = read("../../shared/store/font-providers.ts");
const storeItemCard = read("../../app/components/product/StoreItemCard.tsx");

describe("built-in name font catalog", () => {
  it("publishes affordable pixel, playful, futuristic, and funny font presets", () => {
    const fonts = [
      { id: "store-font-pixel-arcade", family: "Press Start 2P", price: 450 },
      { id: "store-font-playful-bubble", family: "Fredoka", price: 350 },
      { id: "store-font-playful-sketch", family: "Caveat", price: 300 },
      { id: "store-font-future-orbit", family: "Orbitron", price: 550 },
      { id: "store-font-future-space", family: "Space Grotesk", price: 450 },
      { id: "store-font-future-condensed", family: "Bebas Neue", price: 350 },
      { id: "store-font-funny-bungee", family: "Bungee", price: 400 },
    ];

    for (const font of fonts) {
      expect(catalog).toContain(`'${font.id}', 'NAME_FONT'`);
      expect(catalog).toContain(`, ${font.price}, '{"family":"${font.family}"}'`);
      expect(cosmetics).toContain(`"${font.family}"`);
      expect(fontProviders).toContain(`family: "${font.family}"`);
    }

    expect(catalog).toContain('const BUILTIN_STORE_VERSION = "2026-09-18-font-catalog-v6"');
  });

  it("loads approved font resources in the store preview", () => {
    expect(storeItemCard).toContain('import { FontResources } from "./FontResources"');
    expect(storeItemCard).toContain("<FontResources families={[config.family]}");
  });
});
