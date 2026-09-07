import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const storeService = read("../../worker/store/service.ts");
const storeAdmin = read("../../worker/store/admin.ts");
const catalogApi = read("../../worker/catalog/api.ts");
const adminEmotePacks = read("../../app/components/admin/store/AdminEmotePackManager.tsx");

describe("Store schema rollout compatibility", () => {
  it("limits lifecycle fallback to missing-column schema errors", () => {
    expect(storeService).toContain("isStoreLifecycleSchemaError");
    expect(storeService).toContain("no such column");
    expect(storeService).toContain("lifecycle_state");
    expect(storeService).toContain("is_enabled");
  });

  it("keeps the public Store readable before migration 0015 is applied", () => {
    expect(storeService).toContain("legacyListStoreCatalog");
    expect(storeService).toContain("is_active = 1");
    expect(storeService).toContain("status = 'ACTIVE'");
  });

  it("keeps existing cosmetics visible in Admin before migration 0015", () => {
    expect(storeAdmin).toContain("legacyListCatalog");
    expect(storeAdmin).toContain("CASE WHEN s.is_active = 1 THEN 'PUBLISHED' ELSE 'DRAFT' END");
  });

  it("keeps draft emote packs and members inspectable before migration 0015", () => {
    expect(catalogApi).toContain("legacyListEmotePacks");
    expect(catalogApi).toContain("legacyGetEmotePackDetail");
    expect(catalogApi).toContain("CASE WHEN p.status = 'ACTIVE' THEN 'PUBLISHED' ELSE 'DRAFT' END");
  });

  it("serves authenticated Admin emote previews even while a pack is draft or disabled", () => {
    expect(adminEmotePacks).toContain(
      "/api/admin/catalog/emotes/${encodeURIComponent(emote.id)}/media",
    );
    expect(adminEmotePacks).not.toContain(
      "/api/media/catalog/emote/${encodeURIComponent(emote.id)}",
    );
    expect(catalogApi).toContain("handleAdminEmoteAsset");
    expect(catalogApi).toContain('"cache-control": "no-store"');
  });

  it("keeps emote pack Publish and Enable mutations working before migration 0015", () => {
    expect(catalogApi).toContain("legacyUpdateEmotePack");
    expect(catalogApi).toContain("UPDATE emote_packs SET status = ?");
    expect(catalogApi).toContain("UPDATE store_items SET is_active = ?");
    expect(catalogApi).toContain("WHERE pack_id = ? AND status = 'ACTIVE'");
  });
});
