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
const entitlements = read("../../worker/store/entitlements.ts");

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
});
