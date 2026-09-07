import { expect, test } from "@playwright/test";
import { installAdminStoreFixture } from "./test-helpers";

const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

const routes = [
  "/",
  "/search?q=source",
  "/posts/post-verified",
  "/u/aurora",
  "/store",
  "/admin",
  "/admin/moderation",
  "/admin/verifications",
  "/admin/users",
  "/admin/roles",
  "/admin/store",
  "/admin/audit",
];

for (const viewport of viewports) {
  for (const path of routes) {
    test(`${path} has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
}

for (const width of [390, 430]) {
  test(`public Store cards and filters remain contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/store");

    const filter = page.locator(".product-store-filter-bar");
    const card = page.locator(".product-store-item").first();
    await expect(filter).toBeVisible();
    await expect(card).toBeVisible();

    const geometry = await page.evaluate(() => {
      const filterElement = document.querySelector<HTMLElement>(".product-store-filter-bar");
      const cardElement = document.querySelector<HTMLElement>(".product-store-item");
      return {
        documentOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        filterRight: filterElement?.getBoundingClientRect().right ?? Infinity,
        cardRight: cardElement?.getBoundingClientRect().right ?? Infinity,
      };
    });
    expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
    expect(geometry.filterRight).toBeLessThanOrEqual(width + 1);
    expect(geometry.cardRight).toBeLessThanOrEqual(width + 1);
  });
}

test("authorized Admin Store collapses to mobile cards without document overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await installAdminStoreFixture(page);
  await page.goto("/admin/store");
  await page.getByRole("tab", { name: "Emote packs" }).click();

  const pack = page.locator(".admin-store-pack-list__item").filter({ hasText: "E2E Draft Pack" });
  await expect(pack).toBeVisible();
  await pack.click();
  const emote = page.locator(".admin-store-emote-card").filter({ hasText: "E2E Wave" });
  await expect(emote).toBeVisible();

  const geometry = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(".admin-store-emote-card");
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      cardRight: card?.getBoundingClientRect().right ?? Infinity,
    };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.cardRight).toBeLessThanOrEqual(391);
});

test("Store effect previews animate normally and stop under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/store");
  const preview = page.locator(".product-store-preview--star-dust").first();
  await expect(preview).toBeVisible();

  const normalAnimation = await preview.evaluate(
    (element) => getComputedStyle(element, "::before").animationName,
  );
  expect(normalAnimation).not.toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedAnimation = await preview.evaluate(
    (element) => getComputedStyle(element, "::before").animationName,
  );
  expect(reducedAnimation).toBe("none");
});

test("reduced motion remains active on product surfaces", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator("html")).toBeVisible();
  const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  expect(reduced).toBe(true);
});
