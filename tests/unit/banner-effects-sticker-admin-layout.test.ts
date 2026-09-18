import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("banner effects and sticker workspace presentation", () => {
  it("anchors profile effects to the banner surface", () => {
    const card = read("../../app/components/product/ProfileIdentityCard.tsx");
    const layer = read("../../app/components/product/ProfileEffectLayer.tsx");
    const coverStart = card.indexOf('<div className="product-profile-cover"');
    const coverEnd = card.indexOf('<div className="product-profile-card-surface', coverStart);

    expect(coverStart).toBeGreaterThanOrEqual(0);
    expect(coverEnd).toBeGreaterThan(coverStart);
    expect(card.slice(coverStart, coverEnd)).toContain("<ProfileEffectLayer");
    expect(layer).toContain('data-effect-surface="banner"');
    expect(read("../../app/components/product/profile-effects.css")).toContain(
      '[data-effect-surface="banner"]',
    );
  });

  it("gives stickers the same pack navigation model as emotes", () => {
    const picker = read("../../app/components/product/MediaPicker.tsx");
    expect(picker).toContain("activeStickerPackId");
    expect(picker).toContain("stickerPackBarRef");
    expect(picker).toContain('data-pack-tab-id="klipy"');
    expect(picker).toContain('data-pack-id="klipy"');
    expect(picker).toContain('t("mediaPicker.stickerPacks")');
  });

  it("uses the emote-style admin workspace and bulk upload for stickers", () => {
    const manager = read("../../app/components/admin/store/AdminStickerPackManager.tsx");
    expect(manager).toContain("admin-store-pack-layout");
    expect(manager).toContain("admin-store-pack-header");
    expect(manager).toContain("admin-store-add-sticker__form");
    expect(manager).toContain('name="file"');
    expect(manager).toContain("multiple");
    expect(manager).toContain("admin-store-bulk-status");
    expect(manager).toContain("admin-store-sticker-grid");
    expect(manager).toContain(
      "/api/admin/catalog/stickers/${encodeURIComponent(sticker.id)}/media",
    );
    expect(manager).toContain(
      "/api/admin/catalog/stickers/${encodeURIComponent(pack.previewStickerId)}/media",
    );
    expect(manager).toContain('method: "DELETE"');
    expect(manager).toContain("Delete sticker");
  });

  it("keeps the desktop comment composer and media picker full width", () => {
    const css = read("../../app/components/product/product.css");
    const actionsCss = read("../../app/components/product/comment-actions.css");
    const klipyCss = read("../../app/components/product/profile-klipy.css");
    expect(actionsCss).toContain(".product-comment-composer__identity-picker {");
    expect(css).toContain("grid-column: 1 / -1;");
    expect(css).toContain(".product-comment-composer__field {");
    expect(css).toContain("width: 100%;");
    expect(klipyCss).toContain(".product-comment-media-picker {");
    expect(klipyCss).toContain("width: 100%;");
  });
});
