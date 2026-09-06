import { describe, expect, it, vi } from "vitest";
import { persistNotification, type NotificationEvent } from "../../worker/notifications/service";

describe("notification persistence", () => {
  it("uses a deterministic event/recipient key so queue retries are idempotent", async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const statement = {
      bind: vi.fn(() => statement),
      first: vi.fn(async () => null),
      run,
    };
    const db = {
      prepare: vi.fn(() => statement),
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

  it("honors activity preferences and preserves an existing domain notification id", async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const first = vi.fn().mockResolvedValueOnce({ enabled: 0 }).mockResolvedValueOnce(null);
    const statement = {
      bind: vi.fn(() => statement),
      first,
      run,
    };
    const db = { prepare: vi.fn(() => statement) } as unknown as D1Database;
    const event: NotificationEvent = {
      type: "store.purchased",
      eventId: "purchase-123",
      notificationId: "domain-notification-123",
      recipientUserId: "user-1",
    };

    await expect(persistNotification(db, event, 10)).resolves.toBeNull();
    await expect(persistNotification(db, event, 20)).resolves.toBe("domain-notification-123");
    expect(run).toHaveBeenCalledTimes(1);
    expect(statement.bind).toHaveBeenCalledWith(
      "domain-notification-123",
      "user-1",
      "store.purchased",
      null,
      null,
      null,
      null,
      20,
    );
  });
});
