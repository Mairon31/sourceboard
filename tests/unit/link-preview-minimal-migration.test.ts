import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../../migrations/0036_comment_link_preview_minimal.sql", import.meta.url);
const typesSource = readFileSync(new URL("../../worker/comments/types.ts", import.meta.url), "utf8");

describe("MINIMAL link preview persistence", () => {
  it("adds MINIMAL to the persisted D1 metadata-status constraint", () => {
    expect(existsSync(migrationUrl)).toBe(true);
    if (!existsSync(migrationUrl)) return;
    const migration = readFileSync(migrationUrl, "utf8");
    expect(migration).toContain("'COMPLETE', 'PARTIAL', 'MINIMAL', 'URL_ONLY'");
    expect(migration).toContain("INSERT INTO comment_link_previews_v2");
    expect(migration).toContain("ALTER TABLE comment_link_previews_v2 RENAME TO comment_link_previews");
  });

  it("exposes MINIMAL in the worker preview snapshot contract", () => {
    expect(typesSource).toContain('"COMPLETE" | "PARTIAL" | "MINIMAL" | "URL_ONLY"');
  });
});
