import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createD1CommentStore, CommentPostUnavailableError } from "../../worker/comments/store";

function createD1(sqlite: DatabaseSync): D1Database {
  function prepare(query: string) {
    let values: unknown[] = [];
    const statement = {
      bind(...next: unknown[]) {
        values = next;
        return statement;
      },
      async run() {
        const result = sqlite.prepare(query).run(...(values as never[]));
        return { meta: { changes: result.changes } } as D1Result<unknown>;
      },
    };
    return statement;
  }
  return {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
  } as unknown as D1Database;
}

function comment() {
  return {
    id: "comment-2",
    postId: "post-1",
    authorId: "author-1",
    parentCommentId: null,
    richtext: [{ type: "text" as const, text: "Comment" }],
    plaintext: "Comment",
    attachment: null,
    state: "VISIBLE" as const,
    likeCount: 0,
    createdAt: 20,
    updatedAt: 20,
    editDeadlineAt: 1020,
    deletedAt: null,
    hiddenAt: null,
  };
}

describe("comment post lifecycle", () => {
  it("rejects a create that races with post soft-delete", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE posts (
          id TEXT PRIMARY KEY,
          comment_count INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER
        );
        CREATE TABLE comments (
          id TEXT PRIMARY KEY,
          post_id TEXT NOT NULL,
          author_id TEXT NOT NULL,
          parent_comment_id TEXT,
          body_richtext_json TEXT NOT NULL,
          body_plaintext TEXT NOT NULL,
          attachment_json TEXT,
          state TEXT NOT NULL,
          like_count INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          edit_deadline_at INTEGER NOT NULL,
          deleted_at INTEGER,
          hidden_at INTEGER
        );
        INSERT INTO posts VALUES ('post-1', 0, 1, 50);
      `);
      const store = createD1CommentStore(createD1(sqlite));

      await expect(
        store.createComment({
          comment: comment(),
          richtextJson: JSON.stringify([{ type: "text", text: "Comment" }]),
          attachmentJson: null,
        }),
      ).rejects.toBeInstanceOf(CommentPostUnavailableError);
      expect(sqlite.prepare("SELECT id FROM comments").all()).toEqual([]);
      expect(sqlite.prepare("SELECT comment_count FROM posts").get()).toEqual({ comment_count: 0 });
    } finally {
      sqlite.close();
    }
  });
});
