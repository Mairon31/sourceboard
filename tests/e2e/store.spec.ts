import { expect, test } from "@playwright/test";
import { waitForUiReady } from "./test-helpers";

test("store presents the refreshed catalog and category filters", async ({ page }) => {
  await page.goto("/store");

  await expect(page.getByRole("heading", { name: "Make SourceBoard yours" })).toBeVisible();
  for (const label of ["All", "Frame", "Effects", "Font", "Emotes"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Stellar Magic" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Star Dust" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lujo Plata" })).toBeVisible();
  await expect(page.getByText("Available").first()).toBeVisible();
});

test("store filters items and sends signed-out actions to login", async ({ page }) => {
  await page.goto("/store");
  await waitForUiReady(page);

  await page.getByRole("button", { name: "Font", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lujo Plata" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stellar Magic" })).toHaveCount(0);

  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "Sign in" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});
