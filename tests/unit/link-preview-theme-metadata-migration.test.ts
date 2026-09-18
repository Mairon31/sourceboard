import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../migrations/0042_link_preview_theme_color.sql", import.meta.url),
  "utf8",
);

describe("link preview theme metadata migration", () => {
  it("adds a nullable theme color without replacing persisted previews", () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE comment_link_previews (
          comment_id TEXT PRIMARY KEY NOT NULL,
          canonical_url TEXT NOT NULL,
          site_name TEXT,
          title TEXT,
          description TEXT,
          image_url TEXT,
          fetched_at INTEGER NOT NULL,
          metadata_status TEXT NOT NULL
        );
        INSERT INTO comment_link_previews
          (comment_id, canonical_url, title, fetched_at, metadata_status)
        VALUES ('comment-1', 'https://example.com/source', 'Existing', 10, 'COMPLETE');
      `);

      sqlite.exec(migration);
      sqlite
        .prepare("UPDATE comment_link_previews SET theme_color = ? WHERE comment_id = ?")
        .run("#1a2b3c", "comment-1");

      expect(
        sqlite
          .prepare(
            "SELECT canonical_url, title, theme_color FROM comment_link_previews WHERE comment_id = ?",
          )
          .get("comment-1"),
      ).toEqual({
        canonical_url: "https://example.com/source",
        title: "Existing",
        theme_color: "#1a2b3c",
      });
    } finally {
      sqlite.close();
    }
  });
});
