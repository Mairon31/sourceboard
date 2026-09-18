import { describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  assertReason,
  assertReportInput,
  canActOnTarget,
  createModerationService,
} from "../../worker/moderation/service";

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  function prepare(query: string) {
    let bindings: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) {
        bindings = values;
        return statement;
      },
      async first<T>() {
        return (sqlite.prepare(query).get(...(bindings as never[])) ?? null) as T | null;
      },
      async run() {
        const result = sqlite.prepare(query).run(...(bindings as never[]));
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

describe("moderation contracts", () => {
  it("accepts canonical report categories and rejects unknown categories", () => {
    expect(() =>
      assertReportInput({
        targetType: "POST",
        category: "MISLEADING_SOURCE",
        detail: "Needs review",
      }),
    ).not.toThrow();
    expect(() => assertReportInput({ targetType: "POST", category: "UNKNOWN" })).toThrow();
  });

  it("requires a meaningful reason for every moderation action", () => {
    expect(assertReason("  repeated spam  ")).toBe("repeated spam");
    expect(() => assertReason("no")).toThrow();
  });

  it("only accepts the supported contextual posting timeout durations", async () => {
    await expect(
      createModerationService({} as D1Database).apply({
        actorUserId: "moderator-1",
        targetType: "POST",
        targetId: "post-1",
        action: "TIMEOUT_AUTHOR",
        durationMs: 1234,
        reason: "Repeated abusive posting",
        requestId: "request-timeout-invalid",
      }),
    ).rejects.toMatchObject({ code: "INVALID_TIMEOUT_DURATION" });
  });

  it("protects equal and higher roles from lower-ranked actors", () => {
    const moderator = {
      roles: [{ slug: "moderator" as const, rank: 60 }],
      capabilities: new Set<string>(),
    };
    const user = { roles: [{ slug: "user" as const, rank: 10 }], capabilities: new Set<string>() };
    const admin = {
      roles: [{ slug: "admin" as const, rank: 80 }],
      capabilities: new Set<string>(),
    };
    expect(canActOnTarget(moderator, user)).toBe(true);
    expect(canActOnTarget(moderator, admin)).toBe(false);
    expect(canActOnTarget(admin, admin)).toBe(false);
  });

  it("queues a notification for the affected content owner after the action is recorded", async () => {
    const send = vi.fn(async () => undefined);
    const db = {
      prepare: vi.fn((query: string) => {
        const statement = {
          bind: vi.fn(() => statement),
          first: vi.fn(async <T>() =>
            query.includes("FROM posts") ? ({ userId: "target-user" } as T) : null,
          ),
          run: vi.fn(async () => ({ meta: { changes: 1 } })),
        };
        return statement as unknown as D1PreparedStatement;
      }),
      batch: vi.fn(async (statements: D1PreparedStatement[]) =>
        statements.map(() => ({ meta: { changes: 1 } })),
      ),
    } as unknown as D1Database;

    await createModerationService(db, { events: { send } as unknown as Queue }).apply({
      actorUserId: "moderator",
      targetType: "POST",
      targetId: "post-1",
      action: "HIDE",
      reason: "Repeated spam content",
      requestId: "request-1",
    });

    expect(send).toHaveBeenCalledWith({
      notification: expect.objectContaining({
        type: "moderation.action",
        recipientUserId: "target-user",
        entityId: "post-1",
      }),
    });
  });

  it("persists category, like visibility, and author timeout actions atomically", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE posts (
          id TEXT PRIMARY KEY, author_id TEXT NOT NULL, category_slug TEXT NOT NULL,
          status TEXT NOT NULL, archived_at INTEGER, deleted_at INTEGER,
          comments_closed INTEGER NOT NULL DEFAULT 0, comments_closed_at INTEGER,
          hide_like_count INTEGER NOT NULL DEFAULT 0, hidden_at INTEGER,
          locked_at INTEGER, is_nsfw INTEGER NOT NULL DEFAULT 0,
          nsfw_marked_by TEXT, nsfw_marked_at INTEGER, accepted_comment_id TEXT,
          verified_source_id TEXT, updated_at INTEGER
        );
        CREATE TABLE post_categories (slug TEXT PRIMARY KEY, is_archived INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE moderation_actions (
          id TEXT PRIMARY KEY, actor_user_id TEXT, target_type TEXT, target_id TEXT,
          action TEXT, reason TEXT, expires_at INTEGER, request_id TEXT, created_at INTEGER
        );
        CREATE TABLE user_sanctions (
          id TEXT PRIMARY KEY, user_id TEXT, actor_user_id TEXT, kind TEXT,
          reason TEXT, expires_at INTEGER, created_at INTEGER
        );
        CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY, actor_user_id TEXT, action TEXT, target_type TEXT,
          target_id TEXT, reason TEXT, metadata_json TEXT, request_id TEXT,
          ip_prefix_hash TEXT, created_at INTEGER
        );
        INSERT INTO posts (id, author_id, category_slug, status) VALUES ('post-1', 'author-1', 'other', 'OPEN');
        INSERT INTO post_categories VALUES ('other', 0), ('music', 0);
      `);
      const service = createModerationService(createSqliteD1(sqlite));

      await service.apply({
        actorUserId: "moderator-1",
        targetType: "POST",
        targetId: "post-1",
        action: "CHANGE_CATEGORY",
        categorySlug: "music",
        reason: "The post belongs in music",
        requestId: "request-category",
        now: 100,
      });
      await service.apply({
        actorUserId: "moderator-1",
        targetType: "POST",
        targetId: "post-1",
        action: "HIDE_LIKES",
        reason: "Prevent brigading",
        requestId: "request-likes",
        now: 110,
      });
      await service.apply({
        actorUserId: "moderator-1",
        targetType: "POST",
        targetId: "post-1",
        action: "TIMEOUT_AUTHOR",
        durationMs: 86_400_000,
        reason: "Repeated abusive posting",
        requestId: "request-timeout",
        now: 120,
      });

      expect(sqlite.prepare("SELECT category_slug, hide_like_count FROM posts").get()).toEqual({
        category_slug: "music",
        hide_like_count: 1,
      });
      expect(sqlite.prepare("SELECT user_id, kind, expires_at FROM user_sanctions").get()).toEqual({
        user_id: "author-1",
        kind: "POSTING",
        expires_at: 86_400_120,
      });
    } finally {
      sqlite.close();
    }
  });
});
