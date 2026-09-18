import { expect, test } from "@playwright/test";

test.describe("platform overhaul SEO/CMS matrix", () => {
  test("sitemap index exposes bounded public feeds only", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml).toContain("/sitemaps/official-1.xml");
    expect(xml).toContain("/sitemaps/categories.xml");
    expect(xml).not.toContain("/sh/");
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("?lang=");
  });

  test("localized official pages use clean canonicals and parseable JSON-LD when present", async ({
    page,
  }) => {
    await page.goto("/es/docs");
    const canonical = page.locator('link[rel="canonical"]');
    if ((await canonical.count()) > 0) {
      await expect(canonical).not.toHaveAttribute("href", /[?&]lang=/);
    }
    const jsonLd = page.locator('script[type="application/ld+json"]');
    for (let index = 0; index < (await jsonLd.count()); index += 1) {
      const text = await jsonLd.nth(index).textContent();
      expect(() => JSON.parse(text ?? "null")).not.toThrow();
      expect(text ?? "").not.toContain("email_lookup_hash");
    }
  });

  test("sitemap-backed localized pages publish self-canonicals and indexable SSR signals", async ({
    page,
  }) => {
    for (const path of ["/en", "/en/category/anime", "/en/docs", "/en/legal"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `https://srcboard.me${path}`,
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index, follow/);
    }
  });

  test("static documentation and policy links resolve directly to their canonical namespace", async ({
    page,
  }) => {
    for (const path of ["/en/docs/getting-started", "/en/legal/privacy"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `https://srcboard.me${path}`,
      );
    }
  });

  test("share aliases are noindex and never become sitemap identity", async ({ page }) => {
    const response = await page.goto("/sh/platform-overhaul-no-such-share");
    expect(response?.status()).toBe(404);
    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) await expect(robots).toHaveAttribute("content", /noindex/);
  });
});
