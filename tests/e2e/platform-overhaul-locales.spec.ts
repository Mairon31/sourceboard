import { expect, test } from "@playwright/test";

const locales = ["en", "es", "pt", "fr", "ru", "de"] as const;

test.describe("platform overhaul six-locale matrix", () => {
  for (const locale of locales) {
    test(`${locale} official routes are SSR-stable`, async ({ page }) => {
      for (const path of ["", "/store", "/docs", "/legal"]) {
        const response = await page.goto(`/${locale}${path}`);
        expect(response?.status(), `${locale}${path}`).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
      }
    });
  }

  test("UGC canonical identity ignores the interface lang query", async ({ page }) => {
    const response = await page.goto("/u/e2e-navigation-user?lang=ru");
    expect(response?.status()).toBeLessThan(500);
    const canonical = page.locator('link[rel="canonical"]');
    if ((await canonical.count()) > 0) {
      await expect(canonical).not.toHaveAttribute("href", /[?&]lang=/);
    }
  });
});
