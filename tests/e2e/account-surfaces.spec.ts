import { expect, test } from "@playwright/test";

test("profile presents identity, reputation and achievements", async ({ page }) => {
  await page.goto("/profile/aurora");

  await expect(page.getByRole("heading", { name: "Aurora Vale" })).toBeVisible();
  await expect(page.getByText("Source contributor")).toBeVisible();
  await expect(page.getByText("First Source")).toBeVisible();
  await expect(page.getByText("Source Sleuth")).toBeVisible();
  await expect(page.getByRole("link", { name: "Instagram" })).toBeVisible();
});

test("friends surface distinguishes relationship states", async ({ page }) => {
  await page.goto("/friends");

  await expect(page.getByRole("heading", { name: "Friends" })).toBeVisible();
  await expect(page.getByText("Incoming request")).toBeVisible();
  await expect(page.getByText("Request sent")).toBeVisible();
  await expect(page.getByText("Blocked")).toBeVisible();
});

test("notifications surface presents unread state", async ({ page }) => {
  await page.goto("/notifications");

  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByText("Source verified")).toBeVisible();
  await expect(page.getByText("Unread").first()).toBeVisible();
});

test("settings surface includes NSFW and appearance preferences", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByLabel("Hide NSFW posts")).toBeVisible();
  await expect(page.getByLabel("Blur NSFW media")).toBeVisible();
  await expect(page.getByText("Appearance")).toBeVisible();
  await expect(page.getByRole("button", { name: "System theme" })).toBeVisible();
});
