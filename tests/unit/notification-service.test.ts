import { describe, expect, it, vi } from "vitest";
import { persistNotification, type NotificationEvent } from "../../worker/notifications/service";

describe("notification persistence", () => {
  it("uses a deterministic event/recipient key so queue retries are idempotent", async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({ run })),
      })),
    } as unknown as D1Database;
    const event: NotificationEvent = {
      type: "comment.created",
      eventId: "event-123",
      recipientUserId: "user-1",
      entityType: "POST",
      entityId: "post-1",
    };
    await expect(persistNotification(db, event, 10)).resolves.toBe("notification:event-123:user-1");
    await expect(persistNotification(db, event, 20)).resolves.toBe("notification:event-123:user-1");
    expect(run).toHaveBeenCalledTimes(2);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT OR IGNORE"));
  });
});
