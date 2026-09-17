import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../../migrations/0036_link_preview_minimal_status.sql",
  import.meta.url,
);
const typesSource = readFileSync(
  new URL("../../worker/comments/types.ts", import.meta.url),
  "utf8",
);

describe("MINIMAL link preview persistence", () => {
  it("adds MINIMAL to the persisted D1 metadata-status constraint", () => {
    expect(existsSync(migrationUrl)).toBe(true);
    if (!existsSync(migrationUrl)) return;
    const migration = readFileSync(migrationUrl, "utf8");
    expect(migration).toContain("'COMPLETE', 'PARTIAL', 'MINIMAL', 'URL_ONLY'");
    expect(migration).toContain("INSERT INTO comment_link_previews_v2");
    expect(migration).toContain(
      "ALTER TABLE comment_link_previews_v2 RENAME TO comment_link_previews",
    );
  });

  it("exposes MINIMAL in the worker preview snapshot contract", () => {
    expect(typesSource).toContain('"COMPLETE" | "PARTIAL" | "MINIMAL" | "URL_ONLY"');
  });

  it("preserves existing snapshots and accepts MINIMAL in a real SQLite migration", () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE comments (id TEXT PRIMARY KEY NOT NULL);
        INSERT INTO comments (id) VALUES ('comment-1'), ('comment-2'), ('comment-3'), ('comment-4');
        CREATE TABLE comment_link_previews (
          comment_id TEXT PRIMARY KEY NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
          canonical_url TEXT NOT NULL,
          site_name TEXT,
          title TEXT,
          description TEXT,
          image_url TEXT,
          fetched_at INTEGER NOT NULL,
          metadata_status TEXT NOT NULL CHECK (metadata_status IN ('COMPLETE', 'PARTIAL', 'URL_ONLY'))
        );
        CREATE INDEX comment_link_previews_fetched_at_idx
          ON comment_link_previews (fetched_at DESC);
        INSERT INTO comment_link_previews
          (comment_id, canonical_url, site_name, title, description, image_url, fetched_at, metadata_status)
        VALUES
          ('comment-1', 'https://one.example', 'One', 'Title one', NULL, NULL, 10, 'COMPLETE'),
          ('comment-2', 'https://two.example', NULL, 'Title two', NULL, NULL, 20, 'PARTIAL'),
          ('comment-3', 'https://three.example', NULL, NULL, NULL, NULL, 30, 'URL_ONLY');
      `);

      sqlite.exec(readFileSync(migrationUrl, "utf8"));
      sqlite
        .prepare(
          `INSERT INTO comment_link_previews
            (comment_id, canonical_url, site_name, title, description, image_url, fetched_at, metadata_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("comment-4", "https://four.example", null, "Recovered", null, null, 40, "MINIMAL");

      expect(
        sqlite
          .prepare(
            "SELECT comment_id, canonical_url, title, fetched_at, metadata_status FROM comment_link_previews ORDER BY comment_id",
          )
          .all(),
      ).toEqual([
        {
          comment_id: "comment-1",
          canonical_url: "https://one.example",
          title: "Title one",
          fetched_at: 10,
          metadata_status: "COMPLETE",
        },
        {
          comment_id: "comment-2",
          canonical_url: "https://two.example",
          title: "Title two",
          fetched_at: 20,
          metadata_status: "PARTIAL",
        },
        {
          comment_id: "comment-3",
          canonical_url: "https://three.example",
          title: null,
          fetched_at: 30,
          metadata_status: "URL_ONLY",
        },
        {
          comment_id: "comment-4",
          canonical_url: "https://four.example",
          title: "Recovered",
          fetched_at: 40,
          metadata_status: "MINIMAL",
        },
      ]);
      expect(
        sqlite
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'comment_link_previews_fetched_at_idx'",
          )
          .get(),
      ).toEqual({ name: "comment_link_previews_fetched_at_idx" });
    } finally {
      sqlite.close();
    }
  });
});
