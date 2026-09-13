import { describe, expect, it } from "vitest";
import { markNotificationsReadBatch } from "../../worker/notifications/service";

type Row = { id: string; userId: string; readAt: number | null };

function fakeDatabase(seed: Row[]): D1Database {
  const rows = seed.map((row) => ({ ...row }));
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (!sql.includes("UPDATE notifications")) throw new Error(`Unexpected run SQL: ${sql}`);
              const [now, userId, ...ids] = args as [number, string, ...string[]];
              let changes = 0;
              for (const row of rows) {
                if (row.userId === userId && row.readAt === null && ids.includes(row.id)) {
                  row.readAt = now;
                  changes += 1;
                }
              }
              return { meta: { changes } };
            },
            async first<T>() {
              if (!sql.includes("COUNT(*)")) throw new Error(`Unexpected first SQL: ${sql}`);
              const [userId] = args as [string];
              const count = rows.filter((row) => row.userId === userId && row.readAt === null).length;
              return { count } as T;
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe("grouped notification read", () => {
  it("marks only the authenticated recipient's unread rows and is idempotent", async () => {
    const db = fakeDatabase([
      { id: "own-a", userId: "viewer", readAt: null },
      { id: "own-b", userId: "viewer", readAt: null },
      { id: "other", userId: "other-user", readAt: null },
    ]);

    await expect(markNotificationsReadBatch(db, "viewer", ["own-a", "own-b", "other"], 100)).resolves.toEqual({
      marked: 2,
      unreadCount: 0,
    });
    await expect(markNotificationsReadBatch(db, "viewer", ["own-a", "own-b"], 200)).resolves.toEqual({
      marked: 0,
      unreadCount: 0,
    });
    await expect(markNotificationsReadBatch(db, "other-user", [], 300)).resolves.toEqual({
      marked: 0,
      unreadCount: 1,
    });
  });

  it("deduplicates ids and rejects more than 50 supplied ids", async () => {
    const db = fakeDatabase([{ id: "own-a", userId: "viewer", readAt: null }]);
    await expect(markNotificationsReadBatch(db, "viewer", ["own-a", "own-a"], 100)).resolves.toEqual({
      marked: 1,
      unreadCount: 0,
    });
    await expect(
      markNotificationsReadBatch(db, "viewer", Array.from({ length: 51 }, (_, index) => `n-${index}`)),
    ).rejects.toBeInstanceOf(RangeError);
  });
});
