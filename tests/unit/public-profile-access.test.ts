import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { createProfileService } from "../../worker/profile/service";
import type { ProfileStore } from "../../worker/profile/store";
import { createD1ProfileStore } from "../../worker/profile/store-core";
import type { ProfileRecord } from "../../worker/profile/types";

function profile(visibility: "PUBLIC" | "FRIENDS_ONLY" | "PRIVATE"): ProfileRecord {
  return {
    userId: "target",
    username: "public-user",
    usernameNormalized: "public-user",
    displayName: "Public User",
    bio: "Public-safe profile",
    avatarAssetId: null,
    bannerAssetId: null,
    profileVisibility: visibility as ProfileRecord["profileVisibility"],
    createdAt: 1,
    updatedAt: 1,
  };
}

function createStore(visibility: "PUBLIC" | "FRIENDS_ONLY" | "PRIVATE", blocked = false) {
  const target = profile(visibility);
  return {
    getProfileByUsernameNormalized: vi.fn(async () => target),
    getProfileByUserId: vi.fn(async () => target),
    getBlock: vi.fn(async () => blocked),
    getRelationship: vi.fn(async () => "NONE" as const),
    getSocialLinks: vi.fn(async () => []),
    countAcceptedFriends: vi.fn(async () => 0),
    getEquippedCosmetics: vi.fn(async () => ({})),
  } as unknown as ProfileStore;
}

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
        sqlite.prepare(query).run(...(bindings as never[]));
        return { results: [], success: true, meta: {} } as D1Result<T>;
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

function createProfileDatabase() {
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
  `);
  return { sqlite, store: createD1ProfileStore(createSqliteD1(sqlite)) };
}

function seedStoredProfile(
  sqlite: DatabaseSync,
  input: { id: string; username: string; status: string; visibility: string },
) {
  sqlite
    .prepare("INSERT INTO users (id, username, username_normalized, status) VALUES (?, ?, ?, ?)")
    .run(input.id, input.username, input.username, input.status);
  sqlite
    .prepare(
      `INSERT INTO user_profiles
         (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
          created_at, updated_at)
       VALUES (?, ?, '', NULL, NULL, ?, 1, 1)`,
    )
    .run(input.id, input.username, input.visibility);
}

describe("Block B public profile access", () => {
  it("returns the public-safe DTO to a signed-out viewer", async () => {
    const result = await createProfileService({
      store: createStore("PUBLIC"),
      now: () => 10,
    }).getPublicProfile("public-user", null);

    expect(result).toMatchObject({ username: "public-user", profileVisibility: "PUBLIC" });
    expect(result?.canRequestFriend).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/email|session|ipEncrypted|userAgent/i);
  });

  it("keeps friends-only and private profiles unavailable signed out", async () => {
    await expect(
      createProfileService({ store: createStore("FRIENDS_ONLY"), now: () => 10 }).getPublicProfile(
        "public-user",
        null,
      ),
    ).resolves.toBeNull();
    await expect(
      createProfileService({ store: createStore("PRIVATE"), now: () => 10 }).getPublicProfile(
        "public-user",
        null,
      ),
    ).resolves.toBeNull();
  });

  it("keeps a blocked public profile unavailable to the signed-in viewer", async () => {
    await expect(
      createProfileService({ store: createStore("PUBLIC", true), now: () => 10 }).getPublicProfile(
        "public-user",
        "viewer",
      ),
    ).resolves.toBeNull();
  });

  it("preserves PRIVATE rows instead of rehydrating them as PUBLIC", async () => {
    const { sqlite, store } = createProfileDatabase();
    try {
      seedStoredProfile(sqlite, {
        id: "private-user",
        username: "private-user",
        status: "ACTIVE",
        visibility: "PRIVATE",
      });
      await expect(store.getProfileByUsernameNormalized("private-user", 10)).resolves.toMatchObject({
        profileVisibility: "PRIVATE",
      });
    } finally {
      sqlite.close();
    }
  });

  it("does not expose a suspended account through the public username lookup", async () => {
    const { sqlite, store } = createProfileDatabase();
    try {
      seedStoredProfile(sqlite, {
        id: "suspended-user",
        username: "suspended-user",
        status: "SUSPENDED",
        visibility: "PUBLIC",
      });
      await expect(store.getProfileByUsernameNormalized("suspended-user", 10)).resolves.toBeNull();
    } finally {
      sqlite.close();
    }
  });
});
