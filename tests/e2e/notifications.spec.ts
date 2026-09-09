import { expect, test } from "@playwright/test";
import { installNotificationFixture, notificationFixture } from "./notifications-fixture";
import { waitForUiReady } from "./test-helpers";

async function notificationSnapshot(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    return response.json();
  });
}

test("groups related notification records and marks the entire group read", async ({ page }) => {
  await installNotificationFixture(page);
  await page.goto("/notifications");
  await waitForUiReady(page);

  const snapshot = (await notificationSnapshot(page)) as {
    unreadCount: number;
    notifications: Array<{
      groupedIds?: string[];
      groupCount?: number;
      unreadCount?: number;
    }>;
  };
  expect(snapshot.unreadCount).toBe(2);
  expect(snapshot.notifications).toHaveLength(1);
  expect(snapshot.notifications[0]?.groupCount).toBe(2);
  expect(snapshot.notifications[0]?.unreadCount).toBe(2);
  expect(snapshot.notifications[0]?.groupedIds).toEqual([
    notificationFixture.firstNotificationId,
    notificationFixture.secondNotificationId,
  ]);

  await expect(page.getByText("2 related events · 2 new")).toBeVisible();
  await expect(page.getByText(/E2E Liker One and 1 other liked your post/)).toBeVisible();
  await page.getByRole("button", { name: "Mark read" }).click();
  await expect(page.getByText("2 related events", { exact: true })).toBeVisible();
  await expect(page.getByText("2 related events · 2 new")).toHaveCount(0);
  await expect(page.getByText("Read", { exact: true })).toBeVisible();

  await expect
    .poll(async () => ((await notificationSnapshot(page)) as { unreadCount: number }).unreadCount)
    .toBe(0);
});

test("notification popover renders grouped human copy and exact unread count", async ({ page }) => {
  await installNotificationFixture(page);
  await page.goto("/");
  await waitForUiReady(page);

  const trigger = page.getByRole("button", { name: "Notifications" });
  await expect(trigger).toBeVisible();
  await expect(page.getByLabel("2 unread notifications")).toBeVisible();
  await trigger.click();

  const popover = page.getByRole("dialog", { name: "Recent notifications" });
  await expect(popover).toBeVisible();
  await expect(popover.getByText("2 unread", { exact: true })).toBeVisible();
  await expect(popover.getByText(/E2E Liker One and 1 other liked your post/)).toBeVisible();
  await expect(popover.getByText("2 related events · 2 new")).toBeVisible();
  await expect(popover.getByRole("link", { name: "View all" })).toHaveAttribute(
    "href",
    "/notifications",
  );

  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
});
