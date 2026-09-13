import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

test.describe("platform overhaul responsive geometry", () => {
  for (const viewport of VIEWPORTS) {
    test(`keeps 404 actions reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/platform-overhaul-visual-missing");
      const actions = page.locator(".product-not-found__actions");
      await expect(actions).toBeVisible();
      const box = await actions.boundingBox();
      expect(box).not.toBeNull();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width + 1);
    });
  }

  test("keeps localized Docs inside the mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/de/docs");
    const bodyWidth = await page.locator("body").evaluate((node) => node.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(390);
  });
});
