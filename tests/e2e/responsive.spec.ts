import { expect, test } from "@playwright/test";
import { seedCategoryBadgeFixture } from "./category-fixture";
import { friendsFixture, installFriendsFixture } from "./friends-fixture";
import { installAdminStoreFixture, waitForUiReady } from "./test-helpers";

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
  await waitForUiReady(page);
  await page.getByRole("tab", { name: "Emote Packs" }).click();

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

test("friends workspace keeps incoming requests and discovery contained on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installFriendsFixture(page);
  await page.goto("/friends");
  await waitForUiReady(page);

  await page.getByRole("tab", { name: "Incoming" }).click();
  await expect(page.getByText(`@${friendsFixture.incoming}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Decline" })).toBeVisible();

  await page.getByRole("tab", { name: "Discover" }).click();
  await expect(page.getByText(`@${friendsFixture.eligible}`)).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("Store effect previews animate normally and stop under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/store");
  const preview = page.locator('[data-profile-effect="star-dust"]').first();
  await expect(preview).toBeVisible();
  const animatedNode = preview.locator(".product-profile-effect-layer__node").first();
  await expect(animatedNode).toBeAttached();

  const normalAnimation = await animatedNode.evaluate(
    (element) => getComputedStyle(element).animationName,
  );
  expect(normalAnimation).not.toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedAnimation = await animatedNode.evaluate(
    (element) => getComputedStyle(element).animationName,
  );
  expect(["", "none"]).toContain(reducedAnimation);
});

test("Discovery Gallery stays two-column and contained at 390px", async ({ page }) => {
  seedCategoryBadgeFixture();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/search?q=E2E&kind=posts&category=anime&view=gallery");
  await waitForUiReady(page);

  const gallery = page.locator(".product-search-gallery");
  await expect(gallery).toBeVisible();
  const geometry = await gallery.evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(geometry.columns).toBe(2);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
});

test("Discovery Gallery removes overlay transitions under reduced motion", async ({ page }) => {
  seedCategoryBadgeFixture();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/search?q=E2E&kind=posts&category=anime&view=gallery");
  await waitForUiReady(page);

  const overlay = page.locator(".product-search-gallery__overlay").first();
  await expect(overlay).toBeAttached();
  const transitionDuration = await overlay.evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.001);
});

test("reduced motion remains active on product surfaces", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator("html")).toBeVisible();
  const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  expect(reduced).toBe(true);
});

test("desktop home uses the available content column instead of a narrow mobile-width feed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await waitForUiReady(page);

  const layout = await page.locator(".product-page").evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));

  expect(layout.width).toBeGreaterThanOrEqual(900);
  expect(layout.documentOverflow).toBeLessThanOrEqual(1);
});
