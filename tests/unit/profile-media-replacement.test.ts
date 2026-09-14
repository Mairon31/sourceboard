import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createD1ProfileStore } from "../../worker/profile/store-core";

function createD1(sqlite: DatabaseSync): D1Database {
  function prepare(query: string) {
    let values: unknown[] = [];
    const statement = {
      bind(...next: unknown[]) {
        values = next;
        return statement;
      },
      async first<T>() {
        return (sqlite.prepare(query).get(...(values as never[])) ?? null) as T | null;
      },
      async all<T>() {
        return { results: sqlite.prepare(query).all(...(values as never[])) as T[] } as D1Result<T>;
      },
      async run() {
        const result = sqlite.prepare(query).run(...(values as never[]));
        return { meta: { changes: result.changes } } as D1Result<unknown>;
      },
    };
    return statement;
  }
  return {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
  } as unknown as D1Database;
}

describe("profile media replacement", () => {
  it("marks the prior attached asset deleted only after attaching its replacement", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE user_profiles (user_id TEXT PRIMARY KEY, avatar_asset_id TEXT, banner_asset_id TEXT, updated_at INTEGER);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, owner_user_id TEXT, purpose TEXT, r2_key TEXT, content_type TEXT,
          byte_size INTEGER, checksum_sha256 TEXT, status TEXT, created_at INTEGER, deleted_at INTEGER
        );
        INSERT INTO user_profiles VALUES ('user-1', 'old-avatar', NULL, 1);
        INSERT INTO media_assets VALUES ('old-avatar', 'user-1', 'AVATAR', 'profile/user-1/old-avatar', 'image/webp', 42, 'old', 'ACTIVE', 1, NULL);
      `);
      const store = createD1ProfileStore(createD1(sqlite));

      const previous = await store.createMediaAssetAndAttach({
        id: "new-avatar",
        ownerUserId: "user-1",
        purpose: "AVATAR",
        r2Key: "profile/user-1/new-avatar",
        contentType: "image/webp",
        byteSize: 64,
        checksumSha256: "new",
        createdAt: 2,
      });

      expect(previous).toMatchObject({ id: "old-avatar", r2Key: "profile/user-1/old-avatar" });
      expect(
        sqlite.prepare("SELECT avatar_asset_id FROM user_profiles WHERE user_id = 'user-1'").get(),
      ).toEqual({ avatar_asset_id: "new-avatar" });
      expect(
        sqlite.prepare("SELECT status, deleted_at FROM media_assets WHERE id = 'old-avatar'").get(),
      ).toEqual({ status: "DELETED", deleted_at: 2 });
    } finally {
      sqlite.close();
    }
  });
});
