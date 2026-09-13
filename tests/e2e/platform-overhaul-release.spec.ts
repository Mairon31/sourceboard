import { expect, test } from "@playwright/test";
import { seedCosmeticsProfileFixture, seedNavigationPostFixture } from "./test-helpers";

test.describe("social/share/404", () => {
  test.beforeAll(() => seedNavigationPostFixture());

  test("keeps public post identity stable and random routes on the unified 404", async ({ page }) => {
    await page.goto("/posts/e2e-navigation-post/e2e-navigation-post?lang=es");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://srcboard.me/posts/e2e-navigation-post/e2e-navigation-post",
    );
    const response = await page.goto("/this-route-does-not-exist-platform-overhaul");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("404 · SourceBoard")).toBeVisible();
  });
});

test.describe("profiles/security/sessions", () => {
  test.beforeAll(() => seedNavigationPostFixture());

  test("serves signed-out public profiles without exposing account surfaces", async ({ page }) => {
    const response = await page.goto("/u/e2e-navigation-user");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("E2E Navigator")).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://srcboard.me/u/e2e-navigation-user",
    );
  });
});

test.describe("notifications", () => {
  test("keeps notifications private when signed out", async ({ page }) => {
    const response = await page.goto("/notifications");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toContainText("e2e-admin-email-hash");
  });
});

test.describe("cosmetics/fonts/creator", () => {
  test.beforeAll(() => seedCosmeticsProfileFixture());

  test("renders the same canonical cosmetic profile surface with bounded stage geometry", async ({ page }) => {
    await page.goto("/u/e2e-cosmetics");
    await expect(page.getByText("E2E Cosmetics")).toBeVisible();
    const stages = page.locator(".avatar-stage");
    if ((await stages.count()) > 0) {
      const box = await stages.first().boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(0);
      expect(box?.height ?? 0).toBeGreaterThan(0);
    }
  });
});

test.describe("six-locale i18n", () => {
  test("serves all official locale roots from SSR", async ({ page }) => {
    for (const locale of ["en", "es", "pt", "fr", "ru", "de"]) {
      const response = await page.goto(`/${locale}`);
      expect(response?.status(), locale).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
    }
  });
});

test.describe("SEO/CMS", () => {
  test("publishes robots and explicit category/official sitemap feeds", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain("Sitemap: https://srcboard.me/sitemap.xml");

    const categories = await request.get("/sitemaps/categories.xml");
    expect(categories.ok()).toBe(true);
    expect(await categories.text()).toContain("https://srcboard.me/es/category/anime");

    const official = await request.get("/sitemaps/official-1.xml");
    expect(official.ok()).toBe(true);
    expect(await official.text()).toContain("https://srcboard.me/en/docs");
  });
});

test.describe("admin authorization", () => {
  test("never renders the privileged shell for a signed-out request", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator(".admin-shell")).toHaveCount(0);
  });
});
