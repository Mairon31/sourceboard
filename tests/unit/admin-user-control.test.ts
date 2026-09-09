import { describe, expect, it, vi } from "vitest";
import { createAdminUserControlService } from "../../worker/admin/user-control";

interface CapturedStatement {
  sql: string;
  values: unknown[];
}

function createDb(options: { first?: (sql: string) => unknown } = {}) {
  const statements: CapturedStatement[] = [];
  const batch = vi.fn(async (items: unknown[]) =>
    items.map(() => ({ meta: { changes: 1 } })),
  );
  const db = {
    prepare(sql: string) {
      const captured: CapturedStatement = { sql, values: [] };
      statements.push(captured);
      const statement = {
        bind: (...values: unknown[]) => {
          captured.values = values;
          return statement;
        },
        first: vi.fn(async () => options.first?.(sql) ?? null),
        run: vi.fn(async () => ({ meta: { changes: 1 } })),
        all: vi.fn(async () => ({ results: [] })),
      };
      return statement;
    },
    batch,
  } as unknown as D1Database;

  return { db, statements, batch };
}

function sqlText(statements: CapturedStatement[]) {
  return statements.map((statement) => statement.sql).join("\n");
}

describe("admin user moderation controls", () => {
  it("suspends or bans the account and revokes active sessions in one operation", async () => {
    const { db, statements, batch } = createDb();
    const service = createAdminUserControlService(db);

    await service.applyAccountSanctionState({ userId: "user-2", action: "BAN", now: 1234 });

    expect(batch).toHaveBeenCalledOnce();
    expect(sqlText(statements)).toContain("UPDATE users SET status");
    expect(sqlText(statements)).toContain("UPDATE sessions SET revoked_at");
    expect(statements.some((statement) => statement.values.includes("BANNED"))).toBe(true);
  });

  it("revokes all sessions with an audited administrator reason", async () => {
    const { db, statements } = createDb();
    const service = createAdminUserControlService(db);

    await expect(
      service.invalidateSessions({
        actorUserId: "admin-1",
        userId: "user-2",
        reason: "Account security response",
        requestId: "request-1",
        now: 2345,
      }),
    ).resolves.toEqual({ revoked: 1 });

    const sql = sqlText(statements);
    expect(sql).toContain("UPDATE sessions SET revoked_at");
    expect(sql).toContain("admin.user_sessions_revoked");
  });

  it("anonymizes an account as an irreversible privacy-preserving moderation action", async () => {
    const { db, statements, batch } = createDb({
      first: (sql) =>
        sql.includes("SELECT id, status FROM users") ? { id: "user-2", status: "ACTIVE" } : null,
    });
    const service = createAdminUserControlService(db);

    await expect(
      service.anonymizeUser({
        actorUserId: "owner-1",
        userId: "user-2",
        reason: "Approved account deletion request",
        requestId: "request-2",
        now: 3456,
      }),
    ).resolves.toEqual({ anonymized: true });

    expect(batch).toHaveBeenCalledOnce();
    const sql = sqlText(statements);
    expect(sql).toContain("status = 'DELETED'");
    expect(sql).toContain("profile_visibility = 'PRIVATE'");
    expect(sql).toContain("DELETE FROM user_credentials");
    expect(sql).toContain("DELETE FROM user_roles");
    expect(sql).toContain("UPDATE media_assets SET status = 'DELETED'");
    expect(sql).toContain("DELETE FROM friendships");
    expect(sql).toContain("DELETE FROM user_blocks");
    expect(sql).toContain("admin.user_anonymized");
  });
});
