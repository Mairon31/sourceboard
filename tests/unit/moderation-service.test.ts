import { describe, expect, it, vi } from "vitest";
import {
  assertReason,
  assertReportInput,
  canActOnTarget,
  createModerationService,
} from "../../worker/moderation/service";

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
});
