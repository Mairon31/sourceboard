import { expect, test } from "@playwright/test";

test.describe("platform overhaul performance budgets", () => {
  test("ordinary localized page requests no Google font resources", async ({ page }) => {
    const fontRequests: string[] = [];
    page.on("request", (request) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) fontRequests.push(request.url());
    });
    await page.goto("/en/docs");
    await page.waitForLoadState("networkidle");
    expect(fontRequests).toEqual([]);
  });

  test("notification popover/page does not create unbounded DOM while signed out", async ({ page }) => {
    await page.goto("/notifications");
    const cards = page.locator(".notification-card");
    expect(await cards.count()).toBeLessThanOrEqual(100);
  });

  test("sitemap pages stay bounded and queryless", async ({ request }) => {
    const response = await request.get("/sitemaps/categories.xml");
    expect(response.ok()).toBe(true);
    const xml = await response.text();
    const urls = xml.match(/<url>/g) ?? [];
    expect(urls.length).toBeLessThanOrEqual(1000);
    expect(xml).not.toContain("?lang=");
  });
});
