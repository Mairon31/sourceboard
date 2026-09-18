import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../migrations/0041_post_moderation_controls.sql", import.meta.url),
  "utf8",
);

describe("post moderation controls migration", () => {
  it("adds like-count visibility without changing existing post data", () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(
        "CREATE TABLE posts (id TEXT PRIMARY KEY, title TEXT NOT NULL, updated_at INTEGER NOT NULL);",
      );
      sqlite.exec("INSERT INTO posts VALUES ('post-1', 'Existing post', 10);");
      sqlite.exec(migration);

      expect(sqlite.prepare("SELECT id, title, hide_like_count FROM posts").all()).toEqual([
        { id: "post-1", title: "Existing post", hide_like_count: 0 },
      ]);
      expect(
        sqlite
          .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
          .get("posts_hide_like_count_index"),
      ).toEqual({ name: "posts_hide_like_count_index" });
    } finally {
      sqlite.close();
    }
  });
});
