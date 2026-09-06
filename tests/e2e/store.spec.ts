import { expect, test } from "@playwright/test";

test("store presents catalog categories and ownership states", async ({ page }) => {
  await page.goto("/store");

  await expect(page.getByRole("heading", { name: "Personalization store" })).toBeVisible();
  await expect(page.getByText("Nebula Frame")).toBeVisible();
  await expect(page.getByText("Equipped").first()).toBeVisible();
  await expect(page.getByText("Owned").first()).toBeVisible();
  await expect(page.getByText("Insufficient points")).toBeVisible();
  await expect(page.getByText("Unavailable")).toBeVisible();
});

test("store actions disclose their presentation-only boundary", async ({ page }) => {
  await page.goto("/store");
  await page.getByRole("button", { name: "Preview Editorial" }).click();

  await expect(page.getByText("Presentation only")).toBeVisible();
});
