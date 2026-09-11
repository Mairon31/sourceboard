import { expect, test } from "@playwright/test";
import { seedCosmeticsProfileFixture } from "./test-helpers";

test.beforeAll(() => {
  seedCosmeticsProfileFixture();
});

test("profile theme remains card-wide while uploaded banner stays independent", async ({
  page,
}) => {
  await page.goto("/u/e2e-cosmetics");

  const card = page.locator(".product-profile-identity-card");
  const theme = card.locator(':scope > .product-profile-theme-layer[data-profile-theme="nebula"]');
  const cover = card.locator(":scope > .product-profile-cover");
  const photo = cover.locator(":scope > .product-profile-theme-photo");
  const surface = card.locator(":scope > .product-profile-card-surface");

  await expect(page.getByRole("heading", { name: "E2E Cosmetics" })).toBeVisible();
  await expect(card).toBeVisible();
  await expect(theme).toHaveCount(1);
  await expect(cover).toHaveCount(1);
  await expect(photo).toHaveCount(1);
  await expect(cover.locator(".product-profile-theme-layer")).toHaveCount(0);

  const geometry = await Promise.all([
    card.boundingBox(),
    theme.boundingBox(),
    cover.boundingBox(),
  ]);
  expect(geometry[0]).not.toBeNull();
  expect(geometry[1]).not.toBeNull();
  expect(geometry[2]).not.toBeNull();
  expect(Math.abs((geometry[1]?.width ?? 0) - (geometry[0]?.width ?? 0))).toBeLessThanOrEqual(2);
  expect(Math.abs((geometry[1]?.height ?? 0) - (geometry[0]?.height ?? 0))).toBeLessThanOrEqual(2);
  expect((geometry[2]?.height ?? 0) < (geometry[0]?.height ?? 0)).toBe(true);

  const layers = await Promise.all([
    theme.evaluate((element) => Number(getComputedStyle(element).zIndex)),
    cover.evaluate((element) => Number(getComputedStyle(element).zIndex)),
    surface.evaluate((element) => Number(getComputedStyle(element).zIndex)),
  ]);
  expect(layers).toEqual([0, 1, 3]);
  await expect(photo).toHaveCSS("opacity", "0.92");
  await expect(photo).toHaveCSS("background-image", /\/api\/media\/profile\/e2e-cosmetics-banner/);
});
