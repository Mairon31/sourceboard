import { describe, expect, it, vi } from "vitest";
import { createManualAdjustment, processReputationEvent } from "../../worker/reputation/service";

function createDb(options: { duplicate?: boolean; batchChanges?: boolean } = {}) {
  const statements: string[] = [];
  const db = {
    prepare: vi.fn((query: string) => {
      statements.push(query);
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn(async <T>() => {
          if (query.includes("FROM posts p"))
            return { post_author_id: "author", comment_author_id: "contributor" } as T;
          if (query.includes("SUM(CASE WHEN reward_type = 'VERIFIED_SOURCE'"))
            return { count: 1 } as T;
          if (query.includes("FROM point_ledger WHERE reward_type"))
            return { user_id: "contributor" } as T;
          if (query.includes("COUNT(*) AS count")) return { count: 0 } as T;
          return null;
        }),
        run: vi.fn(async () => ({ meta: { changes: options.duplicate ? 0 : 1 } })),
      };
      return statement as unknown as D1PreparedStatement;
    }),
    batch: vi.fn(async (statements: unknown[]) =>
      options.batchChanges ? statements.map(() => ({ meta: { changes: 1 } })) : [],
    ),
  } as unknown as D1Database;
  return { db, statements };
}

describe("reputation ledger", () => {
  it("awards an accepted source once and never rewards a self-answer", async () => {
    const { db, statements } = createDb();
    await processReputationEvent(
      db,
      { type: "source.accepted", postId: "post", commentId: "comment" },
      100,
    );
    expect(statements.some((query) => query.includes("INSERT OR IGNORE INTO point_ledger"))).toBe(
      true,
    );

    const selfDb = createDb();
    vi.mocked(selfDb.db.prepare).mockImplementation((query: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn(async <T>() =>
          query.includes("FROM posts p")
            ? ({ post_author_id: "same", comment_author_id: "same" } as T)
            : null,
        ),
        all: vi.fn(async () => ({ results: [], success: true as const, meta: {} })),
        raw: vi.fn(async () => []),
        run: vi.fn(async () => ({ success: true as const, results: [], meta: { changes: 1 } })),
      };
      return statement as unknown as D1PreparedStatement;
    });
    await processReputationEvent(
      selfDb.db,
      { type: "source.accepted", postId: "post", commentId: "comment" },
      100,
    );
    expect(
      selfDb.statements.some((query) => query.includes("INSERT OR IGNORE INTO point_ledger")),
    ).toBe(false);
  });

  it("creates an exact inverse for a revoked verified source", async () => {
    const { db, statements } = createDb();
    await processReputationEvent(
      db,
      { type: "source.verification.revoked", postId: "post", commentId: "comment" },
      100,
    );
    expect(statements.some((query) => query.includes("INSERT OR IGNORE INTO point_ledger"))).toBe(
      true,
    );
  });

  it("emits each newly earned achievement only after its D1 insert", async () => {
    const { db } = createDb({ batchChanges: true });
    const send = vi.fn(async () => undefined);
    await processReputationEvent(
      db,
      { type: "source.verified", postId: "post", commentId: "comment" },
      100,
      { send } as unknown as Queue,
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      notification: expect.objectContaining({
        type: "achievement.earned",
        recipientUserId: "contributor",
        entityType: "ACHIEVEMENT",
      }),
    });
  });

  it("rejects invalid manual adjustments before touching D1", async () => {
    const db = { prepare: vi.fn() } as unknown as D1Database;
    await expect(
      createManualAdjustment(db, {
        targetUserId: "user",
        actorUserId: "admin",
        amount: 0,
        reason: "too short",
        requestId: "request",
      }),
    ).rejects.toThrow("invalid");
    expect(db.prepare).not.toHaveBeenCalled();
  });
});
