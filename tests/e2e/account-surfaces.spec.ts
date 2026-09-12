import { expect, test } from "@playwright/test";
import { waitForUiReady } from "./test-helpers";

test("profile renders the unified privacy-aware not-found surface without persisted data", async ({
  page,
}) => {
  const response = await page.goto("/u/e2e-missing-profile-account-surface");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This page isn't available", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Home", exact: true })).toHaveAttribute(
    "href",
    "/",
  );
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
