import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createD1CommentStore } from "../../worker/comments/store";

function createD1(sqlite: DatabaseSync, beforeBatch?: () => void): D1Database {
  function prepare(query: string) {
    let values: unknown[] = [];
    const statement = {
      bind(...next: unknown[]) {
        values = next;
        return statement;
      },
      async first<T>() {
        return (sqlite.prepare(query).get(...(values as never[])) ?? null) as T | null;
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
      beforeBatch?.();
      return Promise.all(statements.map((statement) => statement.run()));
    },
  } as unknown as D1Database;
}

function createSchema(sqlite: DatabaseSync): void {
  sqlite.exec(`
    CREATE TABLE comments (
      id TEXT PRIMARY KEY, post_id TEXT NOT NULL, author_id TEXT NOT NULL,
      parent_comment_id TEXT,
      body_richtext_json TEXT NOT NULL, body_plaintext TEXT NOT NULL,
      attachment_json TEXT, state TEXT NOT NULL, like_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      edit_deadline_at INTEGER NOT NULL, deleted_at INTEGER, hidden_at INTEGER
    );
    CREATE TABLE posts (id TEXT PRIMARY KEY, comment_count INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER);
    CREATE TABLE comment_revisions (
      id TEXT PRIMARY KEY, comment_id TEXT NOT NULL, body_richtext_json TEXT NOT NULL,
      body_plaintext TEXT NOT NULL, attachment_json TEXT, editor_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE media_assets (
      id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, purpose TEXT NOT NULL,
      r2_key TEXT NOT NULL, content_type TEXT NOT NULL, byte_size INTEGER NOT NULL,
      width INTEGER, height INTEGER, checksum_sha256 TEXT NOT NULL,
      status TEXT NOT NULL, created_at INTEGER NOT NULL, deleted_at INTEGER
    );
  `);
}

function insertComment(sqlite: DatabaseSync): void {
  sqlite
    .prepare(
      `INSERT INTO comments
       VALUES ('comment-1', 'post-1', 'author-1', NULL, '[{"type":"text","text":"Text"}]',
       'Text', '{"type":"IMAGE","id":"old-image","label":"Old"}', 'VISIBLE', 0,
       1, 10, 1000, NULL, NULL)`,
    )
    .run();
  sqlite.prepare("INSERT INTO posts VALUES ('post-1', 1, 1, NULL)").run();
  sqlite
    .prepare(
      `INSERT INTO media_assets
       VALUES ('old-image', 'author-1', 'COMMENT_IMAGE', 'comments/old-image', 'image/png',
       10, 100, 100, 'old', 'ACTIVE', 1, NULL)`,
    )
    .run();
}

function comment(updatedAt = 20) {
  return {
    id: "comment-1",
    postId: "post-1",
    authorId: "author-1",
    parentCommentId: null,
    richtext: [{ type: "text" as const, text: "Updated" }],
    plaintext: "Updated",
    attachment: null,
    state: "VISIBLE" as const,
    likeCount: 0,
    createdAt: 1,
    updatedAt,
    editDeadlineAt: 1000,
    deletedAt: null,
    hiddenAt: null,
  };
}

describe("comment image lifecycle", () => {
  it("marks the replaced image as deleted after the comment reference changes", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      createSchema(sqlite);
      insertComment(sqlite);
      const store = createD1CommentStore(createD1(sqlite));

      await expect(
        store.updateComment({
          comment: comment(),
          richtextJson: '[{"type":"text","text":"Updated"}]',
          attachmentJson: null,
          revisionId: "revision-1",
          obsoleteCommentImageAssetId: "old-image",
        }),
      ).resolves.toBe(true);

      expect(
        sqlite.prepare("SELECT status, deleted_at FROM media_assets WHERE id = 'old-image'").get(),
      ).toEqual({ status: "DELETED", deleted_at: 20 });
    } finally {
      sqlite.close();
    }
  });

  it("activates a pending image when an existing comment replaces its attachment", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      createSchema(sqlite);
      insertComment(sqlite);
      sqlite
        .prepare(
          `INSERT INTO media_assets
           VALUES ('new-image', 'author-1', 'COMMENT_IMAGE', 'comments/new-image', 'image/png',
           10, 100, 100, 'new', 'PENDING', 20, NULL)`,
        )
        .run();
      const store = createD1CommentStore(createD1(sqlite));

      await expect(
        store.updateComment({
          comment: {
            ...comment(),
            attachment: { type: "IMAGE", id: "new-image", label: "New" },
          },
          richtextJson: '[{"type":"text","text":"Updated"}]',
          attachmentJson: '{"type":"IMAGE","id":"new-image","label":"New"}',
          revisionId: "revision-new-image",
          commentImageAssetId: "new-image",
          obsoleteCommentImageAssetId: "old-image",
        }),
      ).resolves.toBe(true);

      expect(
        sqlite.prepare("SELECT status FROM media_assets WHERE id = 'new-image'").get(),
      ).toEqual({ status: "ACTIVE" });
      expect(
        sqlite.prepare("SELECT status FROM media_assets WHERE id = 'old-image'").get(),
      ).toEqual({ status: "DELETED" });
    } finally {
      sqlite.close();
    }
  });

  it("marks an attached image as deleted when its comment is deleted", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      createSchema(sqlite);
      insertComment(sqlite);
      const store = createD1CommentStore(createD1(sqlite));

      await expect(store.deleteComment("comment-1", "author-1", 30)).resolves.toBe(true);

      expect(
        sqlite.prepare("SELECT status, deleted_at FROM media_assets WHERE id = 'old-image'").get(),
      ).toEqual({ status: "DELETED", deleted_at: 30 });
    } finally {
      sqlite.close();
    }
  });

  it("keeps an image active while another comment still references it", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      createSchema(sqlite);
      insertComment(sqlite);
      sqlite
        .prepare(
          `INSERT INTO comments
           VALUES ('comment-2', 'post-1', 'author-1', NULL, '[{"type":"text","text":"Second"}]',
           'Second', '{"type":"IMAGE","id":"old-image","label":"Old"}', 'VISIBLE', 0,
           2, 2, 1000, NULL, NULL)`,
        )
        .run();
      sqlite.prepare("UPDATE posts SET comment_count = 2 WHERE id = 'post-1'").run();
      const store = createD1CommentStore(createD1(sqlite));

      await expect(store.deleteComment("comment-1", "author-1", 30)).resolves.toBe(true);

      expect(
        sqlite.prepare("SELECT status FROM media_assets WHERE id = 'old-image'").get(),
      ).toEqual({ status: "ACTIVE" });
    } finally {
      sqlite.close();
    }
  });

  it("rejects attaching an image that is already referenced by another comment", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      createSchema(sqlite);
      insertComment(sqlite);
      const store = createD1CommentStore(createD1(sqlite));

      await expect(
        store.createComment({
          comment: {
            id: "comment-2",
            postId: "post-1",
            authorId: "author-1",
            parentCommentId: null,
            richtext: [{ type: "text", text: "Reuse" }],
            plaintext: "Reuse",
            attachment: { type: "IMAGE", id: "old-image", label: "Old" },
            state: "VISIBLE",
            likeCount: 0,
            createdAt: 20,
            updatedAt: 20,
            editDeadlineAt: 1020,
            deletedAt: null,
            hiddenAt: null,
          },
          richtextJson: '[{"type":"text","text":"Reuse"}]',
          attachmentJson: '{"type":"IMAGE","id":"old-image","label":"Old"}',
          commentImageAssetId: "old-image",
        }),
      ).rejects.toThrow("COMMENT_IMAGE_NOT_AVAILABLE");

      expect(sqlite.prepare("SELECT id FROM comments WHERE id = 'comment-2'").all()).toEqual([]);
      expect(
        sqlite.prepare("SELECT status FROM media_assets WHERE id = 'old-image'").get(),
      ).toEqual({
        status: "ACTIVE",
      });
    } finally {
      sqlite.close();
    }
  });

  it("rejects replacing a comment image with an asset used by another comment", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      createSchema(sqlite);
      insertComment(sqlite);
      sqlite
        .prepare(
          `INSERT INTO comments
           VALUES ('comment-2', 'post-1', 'author-1', NULL, '[{"type":"text","text":"Second"}]',
           'Second', '{"type":"IMAGE","id":"other-image","label":"Other"}', 'VISIBLE', 0,
           2, 2, 1000, NULL, NULL)`,
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO media_assets
           VALUES ('other-image', 'author-1', 'COMMENT_IMAGE', 'comments/other-image', 'image/png',
           10, 100, 100, 'other', 'ACTIVE', 1, NULL)`,
        )
        .run();
      const store = createD1CommentStore(createD1(sqlite));

      await expect(
        store.updateComment({
          comment: {
            ...comment(),
            attachment: { type: "IMAGE", id: "other-image", label: "Other" },
          },
          richtextJson: '[{"type":"text","text":"Updated"}]',
          attachmentJson: '{"type":"IMAGE","id":"other-image","label":"Other"}',
          revisionId: "revision-2",
          commentImageAssetId: "other-image",
          obsoleteCommentImageAssetId: "old-image",
        }),
      ).resolves.toBe(false);

      expect(
        sqlite.prepare("SELECT attachment_json FROM comments WHERE id = 'comment-1'").get(),
      ).toEqual({ attachment_json: '{"type":"IMAGE","id":"old-image","label":"Old"}' });
      expect(
        sqlite.prepare("SELECT status FROM media_assets WHERE id = 'old-image'").get(),
      ).toEqual({
        status: "ACTIVE",
      });
    } finally {
      sqlite.close();
    }
  });

  it("does not create a comment after cleanup claims its pending image", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      createSchema(sqlite);
      sqlite.prepare("INSERT INTO posts VALUES ('post-1', 0, 1, NULL)").run();
      sqlite
        .prepare(
          `INSERT INTO media_assets
           VALUES ('pending-image', 'author-1', 'COMMENT_IMAGE', 'comments/pending-image',
           'image/png', 10, 100, 100, 'pending', 'PENDING', 10, NULL)`,
        )
        .run();
      const store = createD1CommentStore(
        createD1(sqlite, () => {
          sqlite
            .prepare(
              `UPDATE media_assets SET status = 'DELETED', deleted_at = 20
               WHERE id = 'pending-image' AND status = 'PENDING'`,
            )
            .run();
        }),
      );

      await expect(
        store.createComment({
          comment: {
            id: "comment-2",
            postId: "post-1",
            authorId: "author-1",
            parentCommentId: null,
            richtext: [{ type: "text", text: "Image comment" }],
            plaintext: "Image comment",
            attachment: { type: "IMAGE", id: "pending-image", label: "Image" },
            state: "VISIBLE",
            likeCount: 0,
            createdAt: 20,
            updatedAt: 20,
            editDeadlineAt: 1020,
            deletedAt: null,
            hiddenAt: null,
          },
          richtextJson: '[{"type":"text","text":"Image comment"}]',
          attachmentJson: '{"type":"IMAGE","id":"pending-image","label":"Image"}',
          commentImageAssetId: "pending-image",
        }),
      ).rejects.toThrow("COMMENT_IMAGE_NOT_AVAILABLE");

      expect(sqlite.prepare("SELECT id FROM comments WHERE id = 'comment-2'").all()).toEqual([]);
      expect(sqlite.prepare("SELECT comment_count FROM posts WHERE id = 'post-1'").get()).toEqual({
        comment_count: 0,
      });
      expect(
        sqlite.prepare("SELECT status FROM media_assets WHERE id = 'pending-image'").get(),
      ).toEqual({
        status: "DELETED",
      });
    } finally {
      sqlite.close();
    }
  });

  it("does not attach an image when cleanup wins between validation and comment edit", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      createSchema(sqlite);
      insertComment(sqlite);
      sqlite
        .prepare(
          `INSERT INTO media_assets
           VALUES ('raced-image', 'author-1', 'COMMENT_IMAGE', 'comments/raced-image', 'image/png',
           10, 100, 100, 'raced', 'PENDING', 20, NULL)`,
        )
        .run();
      const store = createD1CommentStore(
        createD1(sqlite, () => {
          sqlite
            .prepare(
              `UPDATE media_assets SET status = 'DELETED', deleted_at = 21
               WHERE id = 'raced-image' AND status = 'PENDING'`,
            )
            .run();
        }),
      );

      await expect(
        store.updateComment({
          comment: {
            ...comment(),
            attachment: { type: "IMAGE", id: "raced-image", label: "Raced" },
          },
          richtextJson: '[{"type":"text","text":"Updated"}]',
          attachmentJson: '{"type":"IMAGE","id":"raced-image","label":"Raced"}',
          revisionId: "revision-raced-image",
          commentImageAssetId: "raced-image",
          obsoleteCommentImageAssetId: "old-image",
        }),
      ).resolves.toBe(false);

      expect(
        sqlite.prepare("SELECT attachment_json FROM comments WHERE id = 'comment-1'").get(),
      ).toEqual({ attachment_json: '{"type":"IMAGE","id":"old-image","label":"Old"}' });
      expect(
        sqlite.prepare("SELECT status FROM media_assets WHERE id = 'raced-image'").get(),
      ).toEqual({ status: "DELETED" });
    } finally {
      sqlite.close();
    }
  });

  it("does not activate a pending image when a competing comment wins the insert race", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      createSchema(sqlite);
      sqlite.prepare("INSERT INTO posts VALUES ('post-1', 0, 1, NULL)").run();
      sqlite
        .prepare(
          `INSERT INTO media_assets
           VALUES ('pending-image', 'author-1', 'COMMENT_IMAGE', 'comments/pending-image',
           'image/png', 10, 100, 100, 'pending', 'PENDING', 10, NULL)`,
        )
        .run();
      const db = createD1(sqlite, () => {
        sqlite
          .prepare(
            `INSERT INTO comments
               VALUES ('competing-comment', 'post-1', 'author-1', NULL, '[]', '',
               '{"type":"IMAGE","id":"pending-image","label":"Image"}',
               'VISIBLE', 0, 15, 15, 1015, NULL, NULL)`,
          )
          .run();
      });
      const store = createD1CommentStore(db);

      await expect(
        store.createComment({
          comment: {
            id: "comment-2",
            postId: "post-1",
            authorId: "author-1",
            parentCommentId: null,
            richtext: [{ type: "text", text: "Image comment" }],
            plaintext: "Image comment",
            attachment: { type: "IMAGE", id: "pending-image", label: "Image" },
            state: "VISIBLE",
            likeCount: 0,
            createdAt: 20,
            updatedAt: 20,
            editDeadlineAt: 1020,
            deletedAt: null,
            hiddenAt: null,
          },
          richtextJson: '[{"type":"text","text":"Image comment"}]',
          attachmentJson: '{"type":"IMAGE","id":"pending-image","label":"Image"}',
          commentImageAssetId: "pending-image",
        }),
      ).rejects.toThrow("COMMENT_IMAGE_NOT_AVAILABLE");

      expect(
        sqlite.prepare("SELECT status FROM media_assets WHERE id = 'pending-image'").get(),
      ).toEqual({
        status: "PENDING",
      });
    } finally {
      sqlite.close();
    }
  });
});
