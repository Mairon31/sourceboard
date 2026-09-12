import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("username change migration Cloudflare D1 compatibility", () => {
  it("parenthesizes CASE expressions inside the trigger so remote D1 does not split on CASE END", () => {
    const migration = read("../../migrations/0026_username_change_history.sql");

    expect(migration).not.toContain("SELECT CASE");
    expect(migration.match(/SELECT \(CASE/g)).toHaveLength(2);
  });
});
