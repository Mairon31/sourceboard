import { expect, test } from "@playwright/test";
import { waitForUiReady } from "./test-helpers";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("sourceboard-theme"));
});

test("theme follows the system and supports override on product UI", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await waitForUiReady(page);

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "system");

  await page.getByRole("banner").getByRole("button", { name: "Light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "light");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("sourceboard-theme")))
    .toBe("light");

  await page.getByRole("banner").getByRole("button", { name: "System theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("product tabs retain keyboard activation behavior from Phase 0A", async ({ page }) => {
  await page.goto("/");
  await waitForUiReady(page);

  const recent = page.getByRole("tab", { name: "Recent" });
  await recent.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Friends" })).toHaveAttribute("aria-selected", "true");
});

test("Liquid Glass remains restricted to product chrome rather than every content card", async ({
  page,
}) => {
  await page.goto("/");
  await waitForUiReady(page);

  await expect(page.getByRole("banner")).toHaveClass(/glass-panel/);
  await expect(page.locator(".product-post").first()).not.toHaveClass(/glass-panel/);
});
