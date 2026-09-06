import { expect, test } from "@playwright/test";
import { waitForUiReady } from "./test-helpers";

test("admin dashboard uses the moderation-focused shell", async ({ page }) => {
  await page.goto("/admin");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
});

test("moderation queue presents NSFW and source-review context", async ({ page }) => {
  await page.goto("/admin/moderation");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
});

test("anonymous identity reveal is reason-gated", async ({ page }) => {
  await page.goto("/admin/anonymous/post-anonymous");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
});
