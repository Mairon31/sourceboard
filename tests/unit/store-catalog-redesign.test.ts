import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};

const migration = read("../../migrations/0015_store_catalog_lifecycle.sql");
const schema = read("../../worker/db/schema.ts");
const rbac = read("../../worker/auth/rbac.ts");
const adminRead = read("../../worker/admin/read.ts");
const storeService = read("../../worker/store/service.ts");
const storeApi = read("../../worker/store/api.ts");
const storeAdmin = read("../../worker/store/admin.ts");
const entitlements = read("../../worker/store/entitlements.ts");
const catalogApi = read("../../worker/catalog/api.ts");

describe("store catalog lifecycle", () => {
  it("adds lifecycle enablement featured and emote moderation fields", () => {
    expect(migration).toContain("lifecycle_state");
    expect(migration).toContain("is_enabled");
    expect(migration).toContain("is_featured");
    expect(migration).toContain("moderation_state");
    expect(schema).toContain("lifecycleState");
    expect(schema).toContain("moderationState");
  });

  it("adds explicit catalog moderation permission and upgrades admin metrics", () => {
    expect(rbac).toContain('"catalog.moderate"');
    expect(migration).toContain("catalog.moderate");
    expect(adminRead).toContain("lifecycle_state");
    expect(adminRead).toContain("moderation_state = 'FLAGGED'");
  });

  it("requires published enabled Store items and usable emotes", () => {
    expect(storeService).toContain("lifecycle_state = 'PUBLISHED'");
    expect(storeService).toContain("is_enabled = 1");
    expect(entitlements).toContain("moderation_state NOT IN ('HIDDEN', 'REMOVED')");
    expect(entitlements).toContain("p.lifecycle_state = 'PUBLISHED'");
    expect(entitlements).toContain("p.is_enabled = 1");
  });

  it("adds audited Store item administration with reference-safe deletion", () => {
    expect(storeAdmin).toContain("ownerCount");
    expect(storeAdmin).toContain("equippedCount");
    expect(storeAdmin).toContain("STORE_ITEM_REFERENCED");
    expect(storeAdmin).toContain("audit_logs");
    expect(storeApi).toContain("/api/admin/store/catalog");
    expect(storeApi).toContain("/actions");
  });

  it("adds full pack inspection editing replacement and independent duplication", () => {
    expect(catalogApi).toContain("EMOTE_PACK_DUPLICATED");
    expect(catalogApi).toContain("/duplicate");
    expect(catalogApi).toContain("/replace");
    expect(catalogApi).toContain("moderation_state");
    expect(catalogApi).toContain("sort_order");
  });

  it("adds audited individual emote moderation and blocked-media placeholders", () => {
    expect(catalogApi).toContain('"catalog.moderate"');
    expect(catalogApi).toContain("/moderate");
    expect(catalogApi).toContain("EMOTE_REMOVE");
    expect(catalogApi).toContain("image/svg+xml");
    expect(catalogApi).toContain("audit_logs");
  });
});
