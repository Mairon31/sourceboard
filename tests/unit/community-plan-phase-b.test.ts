import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

describe("community plan phase B sticker packs", () => {
  it("models sticker pack lifecycle, global entitlement and item moderation", () => {
    const schema = read("../../worker/db/schema.ts");
    const migration = read("../../migrations/0024_sticker_pack_catalog.sql");
    expect(migration).toContain("sticker_packs");
    expect(migration).toContain("lifecycle_state");
    expect(migration).toContain("is_global");
    expect(migration).toContain("moderation_state");
    expect(schema).toContain("stickerPacks");
  });

  it("exposes entitled SourceBoard sticker packs separately from KLIPY", () => {
    const entitlement = read("../../worker/store/entitlements.ts");
    const comments = read("../../worker/comments/api.ts");
    const picker = read("../../app/components/product/MediaPicker.tsx");
    expect(entitlement).toContain("listEntitledStickerPacks");
    expect(entitlement).toContain("p.is_global = 1");
    expect(comments).toContain('"/api/comments/stickers"');
    expect(picker).toContain("StickerPack");
    expect(picker).toContain('provider: "sourceboard"');
    expect(picker).toContain("/api/comments/stickers");
    expect(picker).toContain("KLIPY");
  });

  it("provides real Admin pack and individual sticker management", () => {
    const admin = read("../../app/routes/admin-store.tsx");
    const manager = read("../../app/components/admin/store/AdminStickerPackManager.tsx");
    const catalog = read("../../worker/catalog/api.ts");
    expect(admin).toContain("AdminStickerPackManager");
    expect(manager).toContain("image/gif");
    expect(manager).toContain("Animated");
    expect(manager).toContain("moderationState");
    expect(catalog).toContain("/api/admin/catalog/sticker-packs");
  });
});
