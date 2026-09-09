import { expect, test } from "@playwright/test";
import { waitForUiReady } from "./test-helpers";

test("profile renders an explicit privacy-aware empty state without persisted data", async ({
  page,
}) => {
  await page.goto("/u/aurora");

  await expect(page.getByRole("heading", { name: "Profile unavailable" })).toBeVisible();
  await expect(
    page.getByText("Public profile data is shown only after server-side privacy checks succeed."),
  ).toBeVisible();
});

test("friends surface requires an authenticated private account", async ({ page }) => {
  await page.goto("/friends");

  await expect(page.getByRole("heading", { name: "Friends", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to manage friends" })).toBeVisible();
  await expect(
    page.getByText(
      "Friend requests and blocks are private account data. Sign in or create an account to manage your connections.",
    ),
  ).toBeVisible();
});

test("notifications surface keeps private activity empty for signed-out visitors", async ({
  page,
}) => {
  await page.goto("/notifications");

  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sign in to see your notifications" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
});

test("settings surface includes NSFW and appearance preferences", async ({ page }) => {
  await page.goto("/settings");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Hide NSFW posts" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Blur NSFW media" })).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("heading", { name: "Theme", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "System theme" })).toBeVisible();
});
