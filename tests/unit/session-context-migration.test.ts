import { existsSync, readFileSync } from "node:fs";
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
});
