import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../app/components/layout/TopBar.tsx", import.meta.url), "utf8");

describe("notification popover", () => {
  it("uses grouped cards, bounded recent history and batch-read semantics", () => {
    expect(source).toContain("NotificationCard");
    expect(source).toContain("recentNotifications.slice(0, 8)");
    expect(source).toContain('to="/notifications"');
    expect(source).toContain('fetch("/api/notifications/read-batch"');
    expect(source).toContain("notificationIds: notification.notificationIds");
    expect(source).not.toContain("groupedIds");
  });
});
