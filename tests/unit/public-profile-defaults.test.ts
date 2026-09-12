import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readOptional(url: URL): string {
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const migration = readOptional(
  new URL("../../migrations/0031_public_profiles_session_context.sql", import.meta.url),
);
const schema = readFileSync(new URL("../../worker/db/schema.ts", import.meta.url), "utf8");

describe("Block B public profile default contract", () => {
  it("force-backfills existing profiles to PUBLIC in migration 0031", () => {
    expect(migration).toMatch(/UPDATE\s+user_profiles\s+SET\s+profile_visibility\s*=\s*'PUBLIC'/i);
  });

  it("keeps new profiles PUBLIC by default", () => {
    expect(schema).toContain(
      'profileVisibility: text("profile_visibility").notNull().default("PUBLIC")',
    );
  });
});
