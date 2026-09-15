import { describe, expect, it, vi } from "vitest";
import { createD1CommentStore } from "../../worker/comments/store";
import type { CommentRecord } from "../../worker/comments/types";

function comment(): CommentRecord {
  return {
    id: "comment-1",
    postId: "post-1",
    authorId: "author-1",
    parentCommentId: null,
    richtext: [{ type: "text", text: "Updated comment" }],
    plaintext: "Updated comment",
    attachment: null,
    state: "VISIBLE",
    likeCount: 0,
    createdAt: 100,
    updatedAt: 150,
    editDeadlineAt: 200,
    deletedAt: null,
    hiddenAt: null,
  };
}

function createTriggeredWriteDb(commentChanges: number) {
  const prepared: string[] = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      prepared.push(sql);
      const statement = {
        bind: vi.fn(() => statement),
        run: vi.fn(async () => ({
          success: true,
          meta: {
            changes: sql.startsWith("UPDATE comments") ? commentChanges : 1,
          },
          results: [],
        })),
        first: vi.fn(async () => (sql.includes("SELECT post_id") ? { post_id: "post-1" } : null)),
      };
      return statement;
    }),
    batch: vi.fn(async (statements: Array<{ run: () => Promise<unknown> }>) =>
      Promise.all(statements.map((statement) => statement.run())),
    ),
  } as unknown as D1Database;
  return {
    db,
    prepared,
    batch: db.batch as unknown as ReturnType<typeof vi.fn>,
  };
}

describe("comment store writes with search-index triggers", () => {
  it("accepts an edit when D1 reports the row plus trigger side effects", async () => {
    const { db, prepared, batch } = createTriggeredWriteDb(3);
    const store = createD1CommentStore(db);

    await expect(
      store.updateComment({
        comment: comment(),
        richtextJson: '[{"type":"text","text":"Updated comment"}]',
        attachmentJson: null,
        revisionId: "revision-1",
      }),
    ).resolves.toBe(true);
    expect(prepared.some((sql) => sql.includes("INSERT INTO comment_revisions"))).toBe(true);
    expect(batch).not.toHaveBeenCalled();
  });

  it("updates the comment and link preview in one D1 batch", async () => {
    const { db, batch } = createTriggeredWriteDb(1);
    const store = createD1CommentStore(db);

    await expect(
      store.updateComment({
        comment: comment(),
        richtextJson: '[{"type":"text","text":"Updated comment"}]',
        attachmentJson: null,
        revisionId: "revision-1",
        linkPreview: {
          canonicalUrl: "https://example.com/article",
          siteName: "Example",
          title: "Article",
          description: "Description",
          imageUrl: null,
          fetchedAt: 150,
          metadataStatus: "PARTIAL",
        },
      }),
    ).resolves.toBe(true);

    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it("accepts a delete when D1 reports the row plus trigger side effects", async () => {
    const { db, prepared } = createTriggeredWriteDb(3);
    const store = createD1CommentStore(db);

    await expect(store.deleteComment("comment-1", "author-1", 150)).resolves.toBe(true);
    expect(prepared.some((sql) => sql.includes("UPDATE posts SET comment_count"))).toBe(true);
  });

  it("still rejects an edit when no comment row matched", async () => {
    const { db } = createTriggeredWriteDb(0);
    const store = createD1CommentStore(db);

    await expect(
      store.updateComment({
        comment: comment(),
        richtextJson: '[{"type":"text","text":"Updated comment"}]',
        attachmentJson: null,
        revisionId: "revision-1",
      }),
    ).resolves.toBe(false);
  });
});
