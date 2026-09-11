import { expect, test } from "@playwright/test";
import { seedAvatarFrameFixtures } from "./cosmetics-fixture";
import {
  installAdminStoreFixture,
  seedCosmeticsProfileFixture,
  waitForUiReady,
} from "./test-helpers";

test.beforeAll(() => {
  seedCosmeticsProfileFixture();
  seedAvatarFrameFixtures();
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

test("legacy profile effect renders across the card and never inside the avatar", async ({
  page,
}) => {
  await page.goto("/u/e2e-cosmetics");

  const card = page.locator(".product-profile-identity-card");
  const effect = card.locator(':scope > [data-profile-effect="rgb-glitch"]');

  await expect(effect).toHaveCount(1);
  await expect(effect.locator(".product-profile-effect-layer__node")).toHaveCount(6);
  await expect(
    page.locator('.cosmetic-identity__avatar-shell [data-profile-effect="rgb-glitch"]'),
  ).toHaveCount(0);
  expect(await effect.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");

  const geometry = await Promise.all([card.boundingBox(), effect.boundingBox()]);
  expect(geometry[0]).not.toBeNull();
  expect(geometry[1]).not.toBeNull();
  expect(Math.abs((geometry[1]?.width ?? 0) - (geometry[0]?.width ?? 0))).toBeLessThanOrEqual(2);
  expect(Math.abs((geometry[1]?.height ?? 0) - (geometry[0]?.height ?? 0))).toBeLessThanOrEqual(2);
});

test("structural fox ears stay on the avatar shell", async ({ page }) => {
  await page.goto("/u/e2e-cosmetics");

  const shell = page.locator('.cosmetic-identity__avatar-shell[data-avatar-frame="fox-ears"]');
  await expect(shell).toHaveCount(1);
  await expect(shell).toHaveClass(/product-avatar-frame--decorative/);
  await expect(shell.locator(".sb-avatar--frame-fox-ears")).toHaveCount(1);

  const before = await shell.evaluate(
    (element) => getComputedStyle(element, "::before").backgroundImage,
  );
  expect(before).not.toBe("none");
});

test("orbit animation decorates the shell without transforming the avatar image", async ({
  page,
}) => {
  await page.goto("/u/e2e-cosmetics-orbit");

  const shell = page.locator('.cosmetic-identity__avatar-shell[data-avatar-frame="orbit-planets"]');
  const avatar = shell.locator(".sb-avatar--frame-orbit-planets");
  await expect(shell).toHaveCount(1);
  await expect(avatar).toHaveCount(1);

  const animationName = await shell.evaluate(
    (element) => getComputedStyle(element, "::before").animationName,
  );
  expect(animationName).toContain("avatar-frame-orbit");
  expect(await avatar.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
});

test("structural avatar frames do not create mobile horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/u/e2e-cosmetics-orbit");

  await expect(
    page.locator('.cosmetic-identity__avatar-shell[data-avatar-frame="orbit-planets"]'),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("Profile, Store and Admin expose the same canonical cosmetic preview attributes", async ({
  page,
}) => {
  await page.goto("/u/e2e-cosmetics");
  const profile = page.locator(".product-profile-identity-card");
  await expect(profile.locator('[data-profile-theme="nebula"]')).toBeVisible();
  await expect(profile.locator('[data-profile-effect="rgb-glitch"]')).toBeVisible();
  await expect(profile.locator('[data-avatar-frame="fox-ears"]')).toBeVisible();

  await page.goto("/store");
  const storeTheme = page
    .locator(".product-store-item")
    .filter({ hasText: "E2E Nebula Theme" })
    .first();
  const storeEffect = page
    .locator(".product-store-item")
    .filter({ hasText: "E2E RGB Glitch Effect" })
    .first();
  const storeFrame = page
    .locator(".product-store-item")
    .filter({ hasText: "E2E Fox Ears" })
    .first();
  await expect(
    storeTheme.locator('.product-cosmetic-preview[data-profile-theme="nebula"]'),
  ).toBeVisible();
  await expect(
    storeEffect.locator('.product-cosmetic-preview [data-profile-effect="rgb-glitch"]'),
  ).toBeVisible();
  await expect(
    storeFrame.locator('.product-cosmetic-preview [data-avatar-frame="fox-ears"]'),
  ).toBeVisible();

  await installAdminStoreFixture(page);
  await page.goto("/admin/store");
  await waitForUiReady(page);
  await page.getByRole("tab", { name: "Presets" }).click();

  const laboratory = page.locator(".admin-preset-lab");
  await expect(laboratory).toBeVisible();

  await page.getByRole("button", { name: "Profile Styles", exact: true }).click();
  await expect(
    laboratory.locator('.product-cosmetic-preview[data-profile-theme="nebula"]'),
  ).toBeVisible();

  await page.getByRole("button", { name: "Effects", exact: true }).click();
  await expect(
    laboratory.locator('.product-cosmetic-preview [data-profile-effect="rgb-glitch"]'),
  ).toBeVisible();

  await page.getByRole("button", { name: "Avatar Frames", exact: true }).click();
  await expect(
    laboratory.locator('.product-cosmetic-preview [data-avatar-frame="fox-ears"]'),
  ).toBeVisible();
});
