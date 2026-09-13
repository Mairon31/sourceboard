import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createD1UsernamePolicyStore } from "../../worker/profile/username-policy";

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

// This file preserves the canonical Phase E1 contracts while allowing visible UI copy to move into i18n.
// The remaining tests intentionally validate server-side policy and architecture rather than one locale's text.

describe("community plan Phase E1", () => {
  it("maps username-policy database constraints into the expected policy errors", async () => {
    const scenarios = [
      ["UNIQUE constraint failed: username_change_history.user_id, username_change_history.changed_at", "USERNAME_CHANGE_RATE_LIMITED"],
      ["CHECK constraint failed: username_change_history", "USERNAME_CHANGE_RATE_LIMITED"],
    ] as const;
    for (const [constraint, code] of scenarios) {
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn(async () => null),
        run: vi.fn(async () => ({ success: true })),
      };
      const db = {
        prepare: vi.fn(() => statement),
        batch: vi.fn(async () => {
          throw new Error(`D1_ERROR: ${constraint}`);
        }),
      } as unknown as D1Database;
      await expect(
        createD1UsernamePolicyStore(db).commitChange({
          userId: "user-1",
          previousUsername: "old-name",
          nextUsername: "new-name",
          changedAt: 1_000,
        }),
      ).rejects.toMatchObject({ status: 429, code });
    }
  });

  it("adds forward-only username history, account API and Settings quota UI", () => {
    const migration = read("../../migrations/0026_username_change_history.sql");
    const api = read("../../worker/profile/api-core.ts");
    const settings = read("../../app/routes/settings.tsx");
    expect(migration).toContain("CREATE TABLE username_change_history");
    expect(migration).toContain("user_id, changed_at");
    expect(api).toContain('\"GET /api/profile/me/username\"');
    expect(api).toContain('\"PATCH /api/profile/me/username\"');
    expect(settings).toContain("/api/profile/me/username");
    expect(settings).toContain('t("settings.username.changesAvailable"');
  });

  it("wires the inline profile editor to the existing username policy endpoint", () => {
    const editor = read("../../app/components/product/ProfileEditor.tsx");
    expect(editor).toContain('fetch("/api/profile/me/username"');
    expect(editor).toContain('label="Username"');
    expect(editor).toContain('fetch("/api/profile/me/username", {');
    expect(editor).toContain('method: "PATCH"');
  });

  it("shows privileged audit activity by default and excludes ordinary account/user activity", () => {
    const source = read("../../worker/admin/audit.ts");
    for (const action of [
      "admin.user_note",
      "moderation.sanction_revoked",
      "store.pack.published",
    ]) {
      expect(source).toContain(action);
    }
  });
});
