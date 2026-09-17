import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createD1ProfileStore } from "../../worker/profile/store-core";

function createD1(
  sqlite: DatabaseSync,
  options: { inflateProfileUpdateChanges?: boolean; beforeBatch?: () => void } = {},
): D1Database {
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
        const changes =
          options.inflateProfileUpdateChanges && query.includes("UPDATE user_profiles")
            ? Number(result.changes) + 2
            : result.changes;
        return { meta: { changes } } as D1Result<unknown>;
      },
    };
    return statement;
  }
  return {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      options.beforeBatch?.();
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
          byte_size INTEGER, width INTEGER, height INTEGER, checksum_sha256 TEXT,
          status TEXT, created_at INTEGER, deleted_at INTEGER
        );
        INSERT INTO user_profiles VALUES ('user-1', 'old-avatar', NULL, 1);
        INSERT INTO media_assets VALUES ('old-avatar', 'user-1', 'AVATAR', 'profile/user-1/old-avatar', 'image/webp', 42, 256, 256, 'old', 'ACTIVE', 1, NULL);
      `);
      const store = createD1ProfileStore(createD1(sqlite, { inflateProfileUpdateChanges: true }));

      const previous = await store.createMediaAssetAndAttach({
        id: "new-avatar",
        ownerUserId: "user-1",
        purpose: "AVATAR",
        r2Key: "profile/user-1/new-avatar",
        contentType: "image/webp",
        byteSize: 64,
        width: 256,
        height: 256,
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

  it("treats a profile clear as matched when public-search trigger writes inflate changes", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE user_profiles (user_id TEXT PRIMARY KEY, avatar_asset_id TEXT, banner_asset_id TEXT, updated_at INTEGER);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, owner_user_id TEXT, purpose TEXT, r2_key TEXT, content_type TEXT,
          byte_size INTEGER, width INTEGER, height INTEGER, checksum_sha256 TEXT,
          status TEXT, created_at INTEGER, deleted_at INTEGER
        );
        INSERT INTO user_profiles VALUES ('user-1', 'avatar-1', NULL, 1);
        INSERT INTO media_assets VALUES ('avatar-1', 'user-1', 'AVATAR', 'profile/user-1/avatar-1', 'image/webp', 42, 256, 256, 'old', 'ACTIVE', 1, NULL);
      `);
      const store = createD1ProfileStore(createD1(sqlite, { inflateProfileUpdateChanges: true }));

      await expect(store.clearMediaAsset("user-1", "AVATAR", "avatar-1", 2)).resolves.toBe(true);
      expect(
        sqlite.prepare("SELECT avatar_asset_id FROM user_profiles WHERE user_id = 'user-1'").get(),
      ).toEqual({ avatar_asset_id: null });
      expect(
        sqlite.prepare("SELECT status, deleted_at FROM media_assets WHERE id = 'avatar-1'").get(),
      ).toEqual({
        status: "DELETED",
        deleted_at: 2,
      });
    } finally {
      sqlite.close();
    }
  });

  it("does not mark a legacy shared asset deleted while another profile slot still references it", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE user_profiles (user_id TEXT PRIMARY KEY, avatar_asset_id TEXT, banner_asset_id TEXT, updated_at INTEGER);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, owner_user_id TEXT, purpose TEXT, r2_key TEXT, content_type TEXT,
          byte_size INTEGER, width INTEGER, height INTEGER, checksum_sha256 TEXT,
          status TEXT, created_at INTEGER, deleted_at INTEGER
        );
        INSERT INTO user_profiles VALUES ('user-1', 'shared', 'shared', 1);
        INSERT INTO user_profiles VALUES ('user-2', 'shared', NULL, 1);
        INSERT INTO media_assets VALUES ('shared', 'user-1', 'AVATAR', 'profile/shared', 'image/webp', 42, 256, 256, 'old', 'ACTIVE', 1, NULL);
      `);
      const store = createD1ProfileStore(createD1(sqlite));

      await expect(store.clearMediaAsset("user-1", "AVATAR", "shared", 2)).resolves.toBe(true);
      expect(sqlite.prepare("SELECT banner_asset_id FROM user_profiles").get()).toEqual({
        banner_asset_id: "shared",
      });
      expect(sqlite.prepare("SELECT status FROM media_assets WHERE id = 'shared'").get()).toEqual({
        status: "ACTIVE",
      });
    } finally {
      sqlite.close();
    }
  });

  it("does not return a shared prior asset for R2 deletion during replacement", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE user_profiles (user_id TEXT PRIMARY KEY, avatar_asset_id TEXT, banner_asset_id TEXT, updated_at INTEGER);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, owner_user_id TEXT, purpose TEXT, r2_key TEXT, content_type TEXT,
          byte_size INTEGER, width INTEGER, height INTEGER, checksum_sha256 TEXT,
          status TEXT, created_at INTEGER, deleted_at INTEGER
        );
        INSERT INTO user_profiles VALUES ('user-1', 'shared-avatar', NULL, 1);
        INSERT INTO user_profiles VALUES ('user-2', 'shared-avatar', NULL, 1);
        INSERT INTO media_assets VALUES ('shared-avatar', 'user-1', 'AVATAR', 'profile/shared-avatar', 'image/webp', 42, 256, 256, 'old', 'ACTIVE', 1, NULL);
      `);
      const store = createD1ProfileStore(createD1(sqlite));

      await expect(
        store.createMediaAssetAndAttach({
          id: "replacement-avatar",
          ownerUserId: "user-1",
          purpose: "AVATAR",
          r2Key: "profile/replacement-avatar",
          contentType: "image/webp",
          byteSize: 64,
          width: 256,
          height: 256,
          checksumSha256: "replacement",
          createdAt: 2,
        }),
      ).resolves.toBeNull();
      expect(
        sqlite.prepare("SELECT avatar_asset_id FROM user_profiles ORDER BY user_id").all(),
      ).toEqual([{ avatar_asset_id: "replacement-avatar" }, { avatar_asset_id: "shared-avatar" }]);
      expect(
        sqlite.prepare("SELECT status FROM media_assets WHERE id = 'shared-avatar'").get(),
      ).toEqual({
        status: "ACTIVE",
      });
    } finally {
      sqlite.close();
    }
  });

  it("does not mark a shared asset deleted when another user still references it", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE user_profiles (user_id TEXT PRIMARY KEY, avatar_asset_id TEXT, banner_asset_id TEXT, updated_at INTEGER);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, owner_user_id TEXT, purpose TEXT, r2_key TEXT, content_type TEXT,
          byte_size INTEGER, width INTEGER, height INTEGER, checksum_sha256 TEXT,
          status TEXT, created_at INTEGER, deleted_at INTEGER
        );
        INSERT INTO user_profiles VALUES ('user-1', 'shared', NULL, 1);
        INSERT INTO user_profiles VALUES ('user-2', 'shared', NULL, 1);
        INSERT INTO media_assets VALUES ('shared', 'user-1', 'AVATAR', 'profile/shared', 'image/webp', 42, 256, 256, 'old', 'ACTIVE', 1, NULL);
      `);
      const store = createD1ProfileStore(createD1(sqlite));

      await expect(store.clearMediaAsset("user-1", "AVATAR", "shared", 2)).resolves.toBe(true);

      expect(sqlite.prepare("SELECT status FROM media_assets WHERE id = 'shared'").get()).toEqual({
        status: "ACTIVE",
      });
    } finally {
      sqlite.close();
    }
  });

  it("rejects a stale replacement instead of overwriting a newer profile slot", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE user_profiles (user_id TEXT PRIMARY KEY, avatar_asset_id TEXT, banner_asset_id TEXT, updated_at INTEGER);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, owner_user_id TEXT, purpose TEXT, r2_key TEXT, content_type TEXT,
          byte_size INTEGER, width INTEGER, height INTEGER, checksum_sha256 TEXT,
          status TEXT, created_at INTEGER, deleted_at INTEGER
        );
        INSERT INTO user_profiles VALUES ('user-1', 'old-avatar', NULL, 1);
        INSERT INTO media_assets VALUES ('old-avatar', 'user-1', 'AVATAR', 'profile/old-avatar', 'image/webp', 42, 256, 256, 'old', 'ACTIVE', 1, NULL);
      `);
      const store = createD1ProfileStore(
        createD1(sqlite, {
          beforeBatch: () => {
            sqlite
              .prepare(
                "UPDATE user_profiles SET avatar_asset_id = 'newer-avatar' WHERE user_id = 'user-1'",
              )
              .run();
          },
        }),
      );

      await expect(
        store.createMediaAssetAndAttach({
          id: "stale-avatar",
          ownerUserId: "user-1",
          purpose: "AVATAR",
          r2Key: "profile/stale-avatar",
          contentType: "image/webp",
          byteSize: 64,
          width: 256,
          height: 256,
          checksumSha256: "stale",
          createdAt: 2,
        }),
      ).rejects.toThrow("PROFILE_MEDIA_ATTACH_FAILED");
      expect(
        sqlite.prepare("SELECT avatar_asset_id FROM user_profiles WHERE user_id = 'user-1'").get(),
      ).toEqual({ avatar_asset_id: "newer-avatar" });
      expect(sqlite.prepare("SELECT id FROM media_assets WHERE id = 'stale-avatar'").all()).toEqual(
        [],
      );
      expect(
        sqlite.prepare("SELECT status FROM media_assets WHERE id = 'old-avatar'").get(),
      ).toEqual({ status: "ACTIVE" });
    } finally {
      sqlite.close();
    }
  });

  it("applies the same compare-and-set replacement contract to profile banners", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE user_profiles (user_id TEXT PRIMARY KEY, avatar_asset_id TEXT, banner_asset_id TEXT, updated_at INTEGER);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, owner_user_id TEXT, purpose TEXT, r2_key TEXT, content_type TEXT,
          byte_size INTEGER, width INTEGER, height INTEGER, checksum_sha256 TEXT,
          status TEXT, created_at INTEGER, deleted_at INTEGER
        );
        INSERT INTO user_profiles VALUES ('user-1', NULL, 'old-banner', 1);
        INSERT INTO media_assets VALUES ('old-banner', 'user-1', 'BANNER', 'profile/old-banner', 'image/webp', 42, 1200, 400, 'old', 'ACTIVE', 1, NULL);
      `);
      const store = createD1ProfileStore(createD1(sqlite));

      const previous = await store.createMediaAssetAndAttach({
        id: "new-banner",
        ownerUserId: "user-1",
        purpose: "BANNER",
        r2Key: "profile/new-banner",
        contentType: "image/webp",
        byteSize: 64,
        width: 1200,
        height: 400,
        checksumSha256: "new",
        createdAt: 2,
      });

      expect(previous).toMatchObject({ id: "old-banner", r2Key: "profile/old-banner" });
      expect(
        sqlite.prepare("SELECT banner_asset_id FROM user_profiles WHERE user_id = 'user-1'").get(),
      ).toEqual({ banner_asset_id: "new-banner" });
      expect(
        sqlite.prepare("SELECT status, deleted_at FROM media_assets WHERE id = 'old-banner'").get(),
      ).toEqual({ status: "DELETED", deleted_at: 2 });
    } finally {
      sqlite.close();
    }
  });

  it("compensates the database row when the profile attach does not match", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE user_profiles (user_id TEXT PRIMARY KEY, avatar_asset_id TEXT, banner_asset_id TEXT, updated_at INTEGER);
        CREATE TABLE media_assets (
          id TEXT PRIMARY KEY, owner_user_id TEXT, purpose TEXT, r2_key TEXT, content_type TEXT,
          byte_size INTEGER, width INTEGER, height INTEGER, checksum_sha256 TEXT,
          status TEXT, created_at INTEGER, deleted_at INTEGER
        );
      `);
      const store = createD1ProfileStore(createD1(sqlite));

      await expect(
        store.createMediaAssetAndAttach({
          id: "orphan-avatar",
          ownerUserId: "missing-user",
          purpose: "AVATAR",
          r2Key: "profile/orphan-avatar",
          contentType: "image/webp",
          byteSize: 64,
          width: 256,
          height: 256,
          checksumSha256: "orphan",
          createdAt: 2,
        }),
      ).rejects.toThrow("PROFILE_MEDIA_ATTACH_FAILED");

      expect(sqlite.prepare("SELECT id FROM media_assets").all()).toEqual([]);
    } finally {
      sqlite.close();
    }
  });
});
