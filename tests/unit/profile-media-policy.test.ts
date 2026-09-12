import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { SourceBoardEnvironment } from "../../worker/environment";
import { handleProfileApiRequest } from "../../worker/profile/api-core";

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  function prepare(query: string) {
    let bindings: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) {
        bindings = values;
        return statement;
      },
      async first<T>() {
        return (sqlite.prepare(query).get(...(bindings as never[])) ?? null) as T | null;
      },
      async all<T>() {
        return {
          results: sqlite.prepare(query).all(...(bindings as never[])) as T[],
          success: true,
          meta: {},
        } as D1Result<T>;
      },
      async run<T>() {
        const result = sqlite.prepare(query).run(...(bindings as never[]));
        return {
          results: [],
          success: true,
          meta: { changes: result.changes },
        } as unknown as D1Result<T>;
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

function createR2Double(objects: Map<string, string>): R2Bucket {
  return {
    async get(key: string) {
      const value = objects.get(key);
      if (value === undefined) return null;
      const bytes = new TextEncoder().encode(value);
      return {
        key,
        size: bytes.byteLength,
        body: new Blob([bytes]).stream(),
        text: async () => value,
      } as unknown as R2ObjectBody;
    },
  } as unknown as R2Bucket;
}

function createMediaDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL,
      username_normalized TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE user_profiles (
      user_id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT,
      bio TEXT,
      avatar_asset_id TEXT,
      banner_asset_id TEXT,
      profile_visibility TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE user_preferences (
      user_id TEXT PRIMARY KEY NOT NULL,
      hide_nsfw INTEGER NOT NULL,
      blur_nsfw INTEGER NOT NULL,
      allow_nsfw_direct_override INTEGER NOT NULL,
      allow_friend_requests INTEGER NOT NULL,
      notify_activity INTEGER NOT NULL,
      notify_friendships INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE media_assets (
      id TEXT PRIMARY KEY NOT NULL,
      owner_user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      content_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
  `);
  return sqlite;
}

function seedMedia(
  sqlite: DatabaseSync,
  input: {
    userId: string;
    username: string;
    accountStatus?: "ACTIVE" | "SUSPENDED";
    visibility: "PUBLIC" | "PRIVATE";
    assetId: string;
    assetStatus?: "ACTIVE" | "DELETED";
    attached: boolean;
  },
) {
  sqlite
    .prepare("INSERT INTO users (id, username, username_normalized, status) VALUES (?, ?, ?, ?)")
    .run(input.userId, input.username, input.username, input.accountStatus ?? "ACTIVE");
  sqlite
    .prepare(
      `INSERT INTO user_profiles
         (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
          created_at, updated_at)
       VALUES (?, ?, '', ?, NULL, ?, 1, 1)`,
    )
    .run(input.userId, input.username, input.attached ? input.assetId : null, input.visibility);
  sqlite
    .prepare(
      `INSERT INTO user_preferences
         (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
          notify_activity, notify_friendships, created_at, updated_at)
       VALUES (?, 1, 1, 0, 1, 1, 1, 1, 1)`,
    )
    .run(input.userId);
  sqlite
    .prepare(
      `INSERT INTO media_assets
         (id, owner_user_id, purpose, r2_key, content_type, byte_size, checksum_sha256,
          status, created_at, deleted_at)
       VALUES (?, ?, 'AVATAR', ?, 'image/png', 5, 'checksum', ?, 1, ?)`,
    )
    .run(
      input.assetId,
      input.userId,
      `profile/${input.userId}/${input.assetId}`,
      input.assetStatus ?? "ACTIVE",
      input.assetStatus === "DELETED" ? 2 : null,
    );
}

async function requestAsset(
  sqlite: DatabaseSync,
  r2: R2Bucket,
  assetId: string,
): Promise<Response> {
  const env = {
    DB: createSqliteD1(sqlite),
    MEDIA: r2,
  } as unknown as SourceBoardEnvironment;
  const response = await handleProfileApiRequest(
    new Request(`https://srcboard.me/api/media/profile/${encodeURIComponent(assetId)}`),
    `req-${assetId}`,
    env,
  );
  if (!response) throw new Error("Profile media route was not handled");
  return response;
}

describe("Block B public profile media policy", () => {
  it("serves only the current active media of publicly viewable active profiles signed out", async () => {
    const sqlite = createMediaDatabase();
    try {
      const cases = [
        {
          userId: "public-user",
          username: "public-user",
          visibility: "PUBLIC" as const,
          assetId: "public-avatar",
          attached: true,
          expected: 200,
        },
        {
          userId: "private-user",
          username: "private-user",
          visibility: "PRIVATE" as const,
          assetId: "private-avatar",
          attached: true,
          expected: 404,
        },
        {
          userId: "detached-user",
          username: "detached-user",
          visibility: "PUBLIC" as const,
          assetId: "detached-avatar",
          attached: false,
          expected: 404,
        },
        {
          userId: "deleted-asset-user",
          username: "deleted-asset-user",
          visibility: "PUBLIC" as const,
          assetId: "deleted-avatar",
          assetStatus: "DELETED" as const,
          attached: true,
          expected: 404,
        },
        {
          userId: "suspended-user",
          username: "suspended-user",
          accountStatus: "SUSPENDED" as const,
          visibility: "PUBLIC" as const,
          assetId: "suspended-avatar",
          attached: true,
          expected: 404,
        },
      ];
      const objects = new Map<string, string>();
      for (const testCase of cases) {
        seedMedia(sqlite, testCase);
        objects.set(`profile/${testCase.userId}/${testCase.assetId}`, "image");
      }
      const r2 = createR2Double(objects);

      for (const testCase of cases) {
        const response = await requestAsset(sqlite, r2, testCase.assetId);
        expect(response.status, testCase.assetId).toBe(testCase.expected);
        expect(response.headers.get("x-request-id"), testCase.assetId).toBe(
          `req-${testCase.assetId}`,
        );
      }
    } finally {
      sqlite.close();
    }
  });
});
