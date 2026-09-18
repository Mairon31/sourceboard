import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("source verification evidence visibility", () => {
  it("adds a private-by-default flag without changing persisted evidence notes", () => {
    const migration = read("../../migrations/0043_source_resolution_evidence_visibility.sql");
    const schema = read("../../worker/db/schema.ts");

    expect(migration).toContain(
      "ALTER TABLE source_resolutions ADD COLUMN evidence_note_public INTEGER NOT NULL DEFAULT 0",
    );
    expect(schema).toContain(
      'evidenceNotePublic: integer("evidence_note_public", { mode: "boolean" })',
    );
    expect(schema).toContain(".notNull().default(false)");

    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE source_resolutions (
          id TEXT PRIMARY KEY NOT NULL,
          evidence_note TEXT
        );
        INSERT INTO source_resolutions (id, evidence_note)
        VALUES ('resolution-1', 'Internal verification context');
      `);

      sqlite.exec(migration);

      expect(
        sqlite
          .prepare(
            "SELECT evidence_note, evidence_note_public FROM source_resolutions WHERE id = ?",
          )
          .get("resolution-1"),
      ).toEqual({
        evidence_note: "Internal verification context",
        evidence_note_public: 0,
      });
    } finally {
      sqlite.close();
    }
  });

  it("passes the visibility choice through verification and public post/search mapping", () => {
    const api = read("../../worker/source/api.ts");
    const postStore = read("../../worker/posts/store.ts");
    const searchService = read("../../worker/search/service.ts");

    expect(api).toContain("showEvidenceNote");
    expect(api).toContain("evidence_note_public");
    expect(api).toContain('kind === "update"');
    expect(api).toContain("UPDATE source_resolutions");
    expect(postStore).toContain("verified_evidence_note_public");
    expect(searchService).toContain(
      "verified_source.evidence_note_public AS verified_evidence_note_public",
    );
  });
});
