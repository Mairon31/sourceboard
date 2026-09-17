import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertCatalogImage } from "../../worker/catalog/image";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

function animatedGif(): Uint8Array {
  return new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x02, 0x00, 0x03, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
    0xff, 0xff, 0xff, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x03, 0x00, 0x00, 0x02, 0x02, 0x44,
    0x01, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x03, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01,
    0x00, 0x3b,
  ]);
}

function headerOnlyGif(): Uint8Array {
  return new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x02, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x3b,
  ]);
}

describe("community plan phase A", () => {
  it("accepts animated GIF emotes by magic bytes and preserves animation metadata", () => {
    const bytes = animatedGif();
    expect(assertCatalogImage(bytes, "image/gif")).toMatchObject({
      contentType: "image/gif",
      width: 2,
      height: 3,
      animated: true,
    });
    expect(() => assertCatalogImage(bytes, "image/png")).toThrow(/MIME|type/i);
  });

  it("rejects GIFs without a decodable frame and GIF polyglots", () => {
    expect(() => assertCatalogImage(headerOnlyGif(), "image/gif")).toThrow(/invalid|image/i);
    expect(() =>
      assertCatalogImage(
        new Uint8Array([...animatedGif(), 0x3c, 0x73, 0x76, 0x67, 0x3e]),
        "image/gif",
      ),
    ).toThrow(/invalid|image/i);
  });

  it("exposes GIF upload and animated status in Admin emote management", () => {
    const manager = read("../../app/components/admin/store/AdminEmotePackManager.tsx");
    const types = read("../../app/components/admin/store/types.ts");
    expect(manager).toContain("image/gif");
    expect(manager).toContain("Animated");
    expect(types).toContain("isAnimated");
  });

  it("removes feed counters while preserving the four Home filters", () => {
    const home = read("../../app/routes/_index.tsx");
    for (const labelKey of [
      "home.feed.recent",
      "home.feed.friends",
      "home.feed.answered",
      "home.feed.verified",
    ]) {
      expect(home).toContain(`label: "${labelKey}"`);
    }
    expect(home).not.toContain("product-feed-filter-tabs__count");
  });

  it("separates Friends counts and gives Like Comment Share equal geometry", () => {
    const productCss = read("../../app/components/product/product.css");
    const postCss = read("../../app/components/product/post-card-refresh.css");
    expect(productCss).toContain(".product-friends-tab-count");
    expect(productCss).toContain("margin-inline-start");
    expect(postCss).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(postCss).toContain(".product-post__actions .product-share-action");
    expect(postCss).toContain("width: 100%");
  });
});
