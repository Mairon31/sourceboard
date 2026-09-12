import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

function readOptional(url: URL): string {
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const migration = readOptional(
  new URL("../../migrations/0031_public_profiles_session_context.sql", import.meta.url),
);
const schema = readFileSync(new URL("../../worker/db/schema.ts", import.meta.url), "utf8");

const sessionContextColumns = [
  "ip_encrypted",
  "ip_key_version",
  "user_agent",
  "cf_city",
  "cf_region",
  "cf_country",
  "context_updated_at",
];

describe("Block B session context migration contract", () => {
  it("adds every session context column in migration 0031", () => {
    for (const column of sessionContextColumns) {
      expect(migration).toContain(`ADD COLUMN ${column}`);
    }
  });

  it("mirrors context columns while preserving existing security hashes", () => {
    for (const column of sessionContextColumns) {
      expect(schema).toContain(`"${column}"`);
    }
    expect(schema).toContain('ipPrefixHash: text("ip_prefix_hash")');
    expect(schema).toContain('userAgentHash: text("user_agent_hash")');
  });

  it("backfills legacy profile visibility and preserves legacy sessions", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`
        CREATE TABLE user_profiles (
          user_id TEXT PRIMARY KEY NOT NULL,
          profile_visibility TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY NOT NULL,
          ip_prefix_hash TEXT,
          user_agent_hash TEXT
        );
        INSERT INTO user_profiles (user_id, profile_visibility, updated_at)
        VALUES ('private-user', 'PRIVATE', 1), ('friends-user', 'FRIENDS_ONLY', 1);
        INSERT INTO sessions (id, ip_prefix_hash, user_agent_hash)
        VALUES ('legacy-session', 'prefix-hash', 'ua-hash');
      `);

      db.exec(migration);

      const profiles = db
        .prepare("SELECT user_id, profile_visibility FROM user_profiles ORDER BY user_id")
        .all() as Array<{ user_id: string; profile_visibility: string }>;
      expect(profiles).toEqual([
        { user_id: "friends-user", profile_visibility: "PUBLIC" },
        { user_id: "private-user", profile_visibility: "PUBLIC" },
      ]);

      const legacy = db
        .prepare(
          `SELECT ip_encrypted, ip_key_version, user_agent, cf_city, cf_region, cf_country,
                  context_updated_at, ip_prefix_hash, user_agent_hash
             FROM sessions WHERE id = 'legacy-session'`,
        )
        .get() as Record<string, unknown>;
      expect(legacy).toMatchObject({
        ip_encrypted: null,
        ip_key_version: null,
        user_agent: null,
        cf_city: null,
        cf_region: null,
        cf_country: null,
        context_updated_at: null,
        ip_prefix_hash: "prefix-hash",
        user_agent_hash: "ua-hash",
      });

      db.exec(
        "UPDATE user_profiles SET profile_visibility = 'PRIVATE' WHERE user_id = 'private-user'",
      );
      expect(
        db
          .prepare("SELECT profile_visibility FROM user_profiles WHERE user_id = 'private-user'")
          .get(),
      ).toEqual({ profile_visibility: "PRIVATE" });
    } finally {
      db.close();
    }
  });
});
