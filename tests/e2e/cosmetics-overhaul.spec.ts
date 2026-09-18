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
    photo.boundingBox(),
  ]);
  expect(geometry[0]).not.toBeNull();
  expect(geometry[1]).not.toBeNull();
  expect(geometry[2]).not.toBeNull();
  expect(geometry[3]).not.toBeNull();
  expect(Math.abs((geometry[1]?.width ?? 0) - (geometry[0]?.width ?? 0))).toBeLessThanOrEqual(2);
  expect(Math.abs((geometry[1]?.height ?? 0) - (geometry[0]?.height ?? 0))).toBeLessThanOrEqual(2);
  expect(Math.abs((geometry[3]?.width ?? 0) - (geometry[2]?.width ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((geometry[3]?.height ?? 0) - (geometry[2]?.height ?? 0))).toBeLessThanOrEqual(1);
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

test("profile page theme and banner geometry remain visible on desktop and mobile", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/u/e2e-cosmetics");

    const pageSurface = page.locator('.product-page--profile[data-profile-theme="nebula"]');
    const cover = page.locator(".product-profile-cover");
    await expect(pageSurface).toBeVisible();
    await expect(cover).toBeVisible();

    const geometry = await cover.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    expect(geometry.width / geometry.height).toBeGreaterThan(2.2);
    expect(geometry.width / geometry.height).toBeLessThan(2.8);
    expect(
      await pageSurface.evaluate((element) => getComputedStyle(element).backgroundImage),
    ).not.toBe("none");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test("banner effect renders inside the banner and never inside the avatar", async ({ page }) => {
  await page.goto("/u/e2e-cosmetics");

  const card = page.locator(".product-profile-identity-card");
  const cover = card.locator(":scope > .product-profile-cover");
  const effect = cover.locator(':scope > [data-profile-effect="rgb-glitch"]');

  await expect(effect).toHaveCount(1);
  await expect(effect).toHaveAttribute("data-effect-surface", "banner");
  await expect(effect.locator(".product-profile-effect-layer__node")).toHaveCount(6);
  await expect(
    page.locator('.product-avatar-stage [data-profile-effect="rgb-glitch"]'),
  ).toHaveCount(0);
  expect(await effect.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");

  const geometry = await Promise.all([cover.boundingBox(), effect.boundingBox()]);
  expect(geometry[0]).not.toBeNull();
  expect(geometry[1]).not.toBeNull();
  expect(Math.abs((geometry[1]?.width ?? 0) - (geometry[0]?.width ?? 0))).toBeLessThanOrEqual(2);
  expect(Math.abs((geometry[1]?.height ?? 0) - (geometry[0]?.height ?? 0))).toBeLessThanOrEqual(2);
});

test("structural fox ears stay on the avatar shell", async ({ page }) => {
  await page.goto("/u/e2e-cosmetics");

  const shell = page.locator('.product-avatar-stage[data-avatar-frame="fox-ears"]');
  await expect(shell).toHaveCount(1);
  await expect(shell).toHaveClass(/product-avatar-frame--decorative/);
  await expect(shell.locator(".product-avatar-stage__avatar .sb-avatar")).toHaveCount(1);

  const ears = shell.locator('.product-avatar-stage__part[data-layer="top-ornament"]');
  await expect(ears).toHaveCount(2);
  for (const ear of await ears.all()) {
    expect(await ear.evaluate((element) => getComputedStyle(element).backgroundImage)).not.toBe(
      "none",
    );
  }
});

test("AvatarStage keeps the avatar and frame anchor on the same normalized box", async ({
  page,
}) => {
  for (const path of ["/u/e2e-cosmetics", "/u/e2e-cosmetics-orbit"]) {
    await page.goto(path);
    const stages = page.locator(".product-avatar-stage");
    await expect(stages.first()).toBeVisible();
    for (const stage of await stages.all()) {
      const geometry = await stage.evaluate((element) => {
        const avatar = element.querySelector<HTMLElement>(".product-avatar-stage__avatar");
        const innerAvatar = element.querySelector<HTMLElement>(
          ".product-avatar-stage__avatar .sb-avatar",
        );
        const stageBox = element.getBoundingClientRect();
        const avatarBox = avatar?.getBoundingClientRect();
        const innerAvatarBox = innerAvatar?.getBoundingClientRect();
        return {
          stage: { width: stageBox.width, height: stageBox.height },
          avatar: { width: avatarBox?.width ?? 0, height: avatarBox?.height ?? 0 },
          innerAvatar: { width: innerAvatarBox?.width ?? 0, height: innerAvatarBox?.height ?? 0 },
        };
      });
      expect(Math.abs(geometry.stage.width - geometry.avatar.width)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(geometry.stage.height - geometry.avatar.height)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(geometry.avatar.width - geometry.innerAvatar.width)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(geometry.avatar.height - geometry.innerAvatar.height)).toBeLessThanOrEqual(
        0.5,
      );
    }
  }
});

test("orbit animation decorates the shell without transforming the avatar image", async ({
  page,
}) => {
  await page.goto("/u/e2e-cosmetics-orbit");

  const shell = page.locator('.product-avatar-stage[data-avatar-frame="orbit-planets"]');
  const avatar = shell.locator(".product-avatar-stage__avatar .sb-avatar");
  await expect(shell).toHaveCount(1);
  await expect(avatar).toHaveCount(1);

  const orbit = shell.locator('.product-avatar-stage__part[data-layer="orbit"]');
  await expect(orbit).toHaveCount(1);
  const animationName = await orbit.evaluate((element) => getComputedStyle(element).animationName);
  expect(animationName).toContain("avatar-stage-orbit");
  expect(await avatar.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
});

test("structural avatar frames do not create mobile horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/u/e2e-cosmetics-orbit");

  await expect(
    page.locator('.product-avatar-stage[data-avatar-frame="orbit-planets"]'),
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

test("reduced motion keeps representative cosmetics static and visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/u/e2e-cosmetics-orbit");

  const orbit = page.locator('.product-avatar-stage[data-avatar-frame="orbit-planets"]');
  await expect(orbit).toBeVisible();
  const orbitPart = orbit.locator('.product-avatar-stage__part[data-layer="orbit"]');
  await expect(orbitPart).toHaveCount(1);
  const orbitStyle = await orbitPart.evaluate((element) => {
    const style = getComputedStyle(element);
    return { animationName: style.animationName, borderTopWidth: style.borderTopWidth };
  });
  expect(orbitStyle.animationName).toBe("none");
  expect(Number.parseFloat(orbitStyle.borderTopWidth)).toBeGreaterThan(0);

  await installAdminStoreFixture(page);
  await page.goto("/admin/store");
  await waitForUiReady(page);
  await page.getByRole("tab", { name: "Presets" }).click();
  await page.getByRole("button", { name: "Effects", exact: true }).click();

  const meteor = page
    .locator('.admin-preset-lab .product-cosmetic-preview [data-profile-effect="meteor-shower"]')
    .first();
  await expect(meteor).toBeVisible();
  const meteorNode = meteor.locator(".product-profile-effect-layer__node").first();
  const meteorStyle = await meteorNode.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationName: style.animationName,
      opacity: Number.parseFloat(style.opacity),
      backgroundImage: style.backgroundImage,
    };
  });
  expect(meteorStyle.animationName).toBe("none");
  expect(meteorStyle.opacity).toBeGreaterThan(0);
  expect(meteorStyle.backgroundImage).not.toBe("none");
});

test("profile cosmetic layers stay contained and actions remain clickable", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/u/e2e-cosmetics");

    const card = page.locator(".product-profile-identity-card");
    const cover = card.locator(":scope > .product-profile-cover");
    const effect = cover.locator(':scope > [data-profile-effect="rgb-glitch"]');
    const share = page.getByRole("button", { name: "Share" }).first();
    await expect(card).toBeVisible();
    await expect(cover).toBeVisible();
    await expect(effect).toBeVisible();
    await expect(effect).toHaveAttribute("data-effect-surface", "banner");
    await expect(share).toBeVisible();
    await share.click({ trial: true });

    const [coverBox, effectBox] = await Promise.all([cover.boundingBox(), effect.boundingBox()]);
    expect(coverBox).not.toBeNull();
    expect(effectBox).not.toBeNull();
    if (coverBox && effectBox) {
      expect(effectBox.x).toBeGreaterThanOrEqual(coverBox.x - 1);
      expect(effectBox.y).toBeGreaterThanOrEqual(coverBox.y - 1);
      expect(effectBox.x + effectBox.width).toBeLessThanOrEqual(coverBox.x + coverBox.width + 1);
      expect(effectBox.y + effectBox.height).toBeLessThanOrEqual(coverBox.y + coverBox.height + 1);
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
