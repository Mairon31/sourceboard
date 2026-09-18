import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPostAuthorIdentity } from "../../worker/comments/service";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../migrations/0040_comment_author_identity.sql");
const schema = read("../../worker/db/schema.ts");
const store = read("../../worker/comments/store.ts");
const service = read("../../worker/comments/service.ts");
const thread = read("../../app/components/product/CommentThread.tsx");
const postDetail = read("../../app/routes/post-detail.tsx");

describe("comment author identity contract", () => {
  it("persists an explicit comment identity without changing historical anonymous comments", () => {
    expect(migration).toContain("ADD COLUMN author_mode");
    expect(migration).toContain("UPDATE comments");
    expect(migration).toContain("posts.author_mode = 'ANONYMOUS'");
    expect(schema).toContain('authorMode: text("author_mode")');
    expect(store).toContain("comment_author_mode");
  });

  it("backfills legacy anonymous comments and rejects invalid identity modes", () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE posts (
          id TEXT PRIMARY KEY,
          author_id TEXT NOT NULL,
          author_mode TEXT NOT NULL
        );
        CREATE TABLE comments (
          id TEXT PRIMARY KEY,
          post_id TEXT NOT NULL,
          author_id TEXT NOT NULL
        );
        INSERT INTO posts VALUES
          ('anonymous-post', 'author-1', 'ANONYMOUS'),
          ('identified-post', 'author-1', 'IDENTIFIED');
        INSERT INTO comments VALUES
          ('anonymous-comment', 'anonymous-post', 'author-1'),
          ('identified-comment', 'identified-post', 'author-1');
      `);

      sqlite.exec(migration);

      expect(sqlite.prepare("SELECT author_mode FROM comments ORDER BY id").all()).toEqual([
        { author_mode: "ANONYMOUS" },
        { author_mode: "IDENTIFIED" },
      ]);
      expect(() =>
        sqlite
          .prepare("INSERT INTO comments (id, post_id, author_id, author_mode) VALUES (?, ?, ?, ?)")
          .run("invalid", "identified-post", "author-1", "INVALID"),
      ).toThrow();
    } finally {
      sqlite.close();
    }
  });

  it("lets only the anonymous post author choose anonymous comments server-side", () => {
    expect(service).toContain("authorMode?: unknown");
    expect(service).toContain("COMMENT_ANONYMOUS_IDENTITY_UNAVAILABLE");
    expect(service).toContain("authorMode: resolvedAuthorMode");
    expect(service).toContain("record.comment.authorMode");
  });

  it("only marks a comment as authored by the post author when identity mode also matches", () => {
    expect(
      isPostAuthorIdentity({
        commentAuthorId: "author-1",
        postAuthorId: "author-1",
        postAuthorMode: "ANONYMOUS",
        commentAuthorMode: "IDENTIFIED",
      }),
    ).toBe(false);
    expect(
      isPostAuthorIdentity({
        commentAuthorId: "author-1",
        postAuthorId: "author-1",
        postAuthorMode: "ANONYMOUS",
        commentAuthorMode: "ANONYMOUS",
      }),
    ).toBe(true);
    expect(
      isPostAuthorIdentity({
        commentAuthorId: "author-1",
        postAuthorId: "author-1",
        postAuthorMode: "IDENTIFIED",
        commentAuthorMode: "IDENTIFIED",
      }),
    ).toBe(true);
  });

  it("defaults the anonymous post author to Anonymous Author and exposes a switch", () => {
    expect(postDetail).toContain("canChooseCommentIdentity");
    expect(thread).toContain("commentAuthorMode");
    expect(thread).toContain('t("comments.composer.identity.label")');
    expect(thread).toContain(
      "authorMode: canChooseCommentIdentity ? commentAuthorMode : undefined",
    );
    expect(thread).toContain('useState<"IDENTIFIED" | "ANONYMOUS">');
  });
});
