import { describe, expect, it, vi } from "vitest";
import { createD1CommentStore } from "../../worker/comments/store";
import type { CommentRecord } from "../../worker/comments/types";

const missingPreviewTable = new Error(
  "D1_ERROR: no such table: comment_link_previews: SQLITE_ERROR",
);

const row = {
  id: "comment-1",
  post_id: "post-1",
  author_id: "author-1",
  parent_comment_id: null,
  body_richtext_json: JSON.stringify([{ type: "text", text: "Legacy comment" }]),
  body_plaintext: "Legacy comment",
  attachment_json: null,
  state: "VISIBLE",
  like_count: 0,
  created_at: 100,
  updated_at: 100,
  edit_deadline_at: 200,
  deleted_at: null,
  hidden_at: null,
  link_preview_canonical_url: null,
  link_preview_site_name: null,
  link_preview_title: null,
  link_preview_description: null,
  link_preview_image_url: null,
  link_preview_fetched_at: null,
  link_preview_metadata_status: null,
  author_username: "author",
  author_display_name: "Author",
  author_avatar_asset_id: null,
  post_author_id: "author-1",
  post_author_mode: "IDENTIFIED",
  post_visibility: "PUBLIC",
  post_status: "OPEN",
  post_deleted_at: null,
  post_hidden_at: null,
};

function createReadSchemaLagDb() {
  const prepared: string[] = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        all: vi.fn(async <T>() => {
          prepared.push(sql);
          if (sql.includes("comment_link_previews")) throw missingPreviewTable;
          return { results: (sql.includes("WITH RECURSIVE") ? [] : [row]) as T[] };
        }),
        first: vi.fn(async <T>() => {
          prepared.push(sql);
          if (sql.includes("comment_link_previews")) throw missingPreviewTable;
          return row as T;
        }),
      };
      return statement;
    }),
  } as unknown as D1Database;
  return { db, prepared };
}

function createWriteSchemaLagDb() {
  const batches: string[][] = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      const statement = {
        sql,
        bind: vi.fn(() => statement),
      };
      return statement;
    }),
    batch: vi.fn(async (statements: Array<{ sql: string }>) => {
      const sql = statements.map((statement) => statement.sql);
      batches.push(sql);
      if (sql.some((statement) => statement.includes("INSERT INTO comment_link_previews"))) {
        throw missingPreviewTable;
      }
      return sql.map(() => ({ success: true, meta: { changes: 1 }, results: [] }));
    }),
  } as unknown as D1Database;
  return { db, batches };
}

function comment(): CommentRecord {
  return {
    id: "comment-1",
    postId: "post-1",
    authorId: "author-1",
    parentCommentId: null,
    richtext: [{ type: "text", text: "Legacy comment" }],
    plaintext: "Legacy comment",
    attachment: null,
    state: "VISIBLE",
    likeCount: 0,
    createdAt: 100,
    updatedAt: 100,
    editDeadlineAt: 200,
    deletedAt: null,
    hiddenAt: null,
  };
}

describe("comment link-preview production schema compatibility", () => {
  it("keeps comment reads available before migration 0027", async () => {
    const { db, prepared } = createReadSchemaLagDb();
    const store = createD1CommentStore(db);

    const listed = await store.listForPost({
      postId: "post-1",
      cursor: null,
      limit: 50,
      sort: "recent",
    });
    const fetched = await store.getComment("comment-1");

    expect(listed.comments).toHaveLength(1);
    expect(listed.comments[0]?.linkPreview).toBeNull();
    expect(fetched?.linkPreview).toBeNull();
    expect(prepared.some((sql) => sql.includes("NULL AS link_preview_canonical_url"))).toBe(true);
  });

  it("preserves the comment when an optional preview cannot be persisted yet", async () => {
    const { db, batches } = createWriteSchemaLagDb();
    const store = createD1CommentStore(db);

    await expect(
      store.createComment({
        comment: comment(),
        richtextJson: JSON.stringify([{ type: "text", text: "Legacy comment" }]),
        attachmentJson: null,
        linkPreview: {
          canonicalUrl: "https://example.com/source",
          siteName: "Example",
          title: "Source",
          description: null,
          imageUrl: null,
          fetchedAt: 100,
          metadataStatus: "PARTIAL",
        },
      }),
    ).resolves.toBeUndefined();

    expect(batches).toHaveLength(2);
    expect(batches[0]?.some((sql) => sql.includes("INSERT INTO comment_link_previews"))).toBe(true);
    expect(batches[1]?.some((sql) => sql.includes("INSERT INTO comment_link_previews"))).toBe(
      false,
    );
  });

  it("does not hide unrelated D1 read failures", async () => {
    const db = {
      prepare: vi.fn(() => {
        const statement = {
          bind: vi.fn(() => statement),
          all: vi.fn(async () => {
            throw new Error("D1_ERROR: database unavailable");
          }),
        };
        return statement;
      }),
    } as unknown as D1Database;
    const store = createD1CommentStore(db);

    await expect(
      store.listForPost({ postId: "post-1", cursor: null, limit: 50, sort: "recent" }),
    ).rejects.toThrow("database unavailable");
  });
});
