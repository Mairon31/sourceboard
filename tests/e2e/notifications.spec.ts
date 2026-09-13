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
      notificationIds: string[];
      grouped: boolean;
      actorCount: number;
      unread: boolean;
    }>;
  };
  expect(snapshot.unreadCount).toBe(2);
  expect(snapshot.notifications).toHaveLength(1);
  expect(snapshot.notifications[0]).toMatchObject({ grouped: true, actorCount: 2, unread: true });
  expect(snapshot.notifications[0]?.notificationIds).toEqual([
    notificationFixture.firstNotificationId,
    notificationFixture.secondNotificationId,
  ]);

  await expect(page.getByText("2 related events · new")).toBeVisible();
  await expect(page.getByText(/E2E Liker One and 1 other liked your post/)).toBeVisible();
  await page.getByLabel("Notification actions").click();
  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect(page.getByText("2 related events", { exact: true })).toBeVisible();
  await expect(page.getByText("2 related events · new")).toHaveCount(0);

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
  await expect(popover.getByText("2 related events · new")).toBeVisible();
  await expect(popover.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/notifications");
  await expect(popover).not.toContainText("**");
  await expect(popover).not.toContainText("emt_");

  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
});

test("mobile notification cards keep content width and actions below the main copy", async ({ page }) => {
  await installNotificationFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notifications");
  await waitForUiReady(page);

  const card = page.locator(".product-notification-card").first();
  await expect(card).toBeVisible();
  await expect(card.getByText(/E2E Liker One and 1 other liked your post/)).toBeVisible();
  await expect(card).not.toContainText("**");
  await expect(card).not.toContainText("emt_");

  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
});
