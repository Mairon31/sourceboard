import { expect, test } from "@playwright/test";
import { waitForUiReady } from "./test-helpers";

test("store presents published catalog categories and honest pack states", async ({ page }) => {
  await page.goto("/store");

  await expect(page.getByRole("heading", { name: "Personalization store" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nebula Frame" })).toBeVisible();
  await expect(page.getByText("Available").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Glass Aurora" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Editorial" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Source Hunters" })).toBeVisible();
  await expect(page.getByText("No published emotes yet.")).toBeVisible();
});

test("store actions render the selected cosmetic preview", async ({ page }) => {
  await page.goto("/store");
  await waitForUiReady(page);
  await page.getByRole("button", { name: "Preview Editorial" }).click();

  await expect(page.getByRole("status")).toContainText("Previewing Editorial");
  await expect(page.getByText("Georgia")).toBeVisible();
});
