import { expect, test } from "@playwright/test";
import {
  cleanupCommentImageLightboxFixture,
  seedCommentImageLightboxFixture,
} from "./comment-media-fixture";
import { seedCategoryBadgeFixture } from "./category-fixture";
import { seedNavigationPostFixture, waitForUiReady } from "./test-helpers";

const IMAGE = `
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
    <rect width="900" height="600" fill="#182238"/>
    <circle cx="450" cy="300" r="180" fill="#63d7ff"/>
  </svg>
`;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/media/post/e2e-navigation-media", (route) =>
    route.fulfill({ status: 200, contentType: "image/svg+xml", body: IMAGE }),
  );
  await page.route("**/api/media/comment/e2e-lightbox-comment-image", (route) =>
    route.fulfill({ status: 200, contentType: "image/svg+xml", body: IMAGE }),
  );
});

test.afterEach(() => {
  cleanupCommentImageLightboxFixture();
});

test("post image opens the shared accessible lightbox and restores focus", async ({ page }) => {
  seedNavigationPostFixture();
  await page.goto("/");
  await waitForUiReady(page);

  const card = page.locator(".product-post", { hasText: "E2E navigation post" });
  const trigger = card.getByRole("button", { name: "Preview image" });
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Image viewer" });
  await expect(dialog).toBeVisible();
  const viewport = dialog.locator(".product-media-lightbox__viewport");
  await expect(viewport).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Zoom in" })).toBeVisible();
  const viewportBox = await viewport.boundingBox();
  const imageBox = await dialog.locator(".product-media-lightbox__image").boundingBox();
  expect(viewportBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(
    Math.abs(
      (imageBox?.y ?? 0) +
        (imageBox?.height ?? 0) / 2 -
        ((viewportBox?.y ?? 0) + (viewportBox?.height ?? 0) / 2),
    ),
  ).toBeLessThan(24);

  await dialog.getByRole("button", { name: "Zoom in" }).click();
  await expect(dialog.locator("output")).toHaveText("150%");
  const image = dialog.locator(".product-media-lightbox__image");
  await expect(image).toHaveAttribute("style", /scale\(1\.5\)/);

  await viewport.focus();
  await page.mouse.move(450, 350);
  await page.mouse.down();
  await page.mouse.move(490, 380);
  await page.mouse.up();
  await expect(image).toHaveAttribute("style", /translate3d\(40px, 30px, 0px\)/);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("comment image uses the same lightbox on mobile", async ({ page }) => {
  seedCommentImageLightboxFixture();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/posts/e2e-navigation-post/e2e-navigation-post");
  await waitForUiReady(page);

  const comment = page.locator("#comment-e2e-lightbox-comment");
  const trigger = comment.getByRole("button", { name: "Open image" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Image viewer" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".product-media-lightbox__image")).toHaveAttribute(
    "alt",
    "Comment lightbox image",
  );
  const mobileViewportBox = await dialog.locator(".product-media-lightbox__viewport").boundingBox();
  const mobileImageBox = await dialog.locator(".product-media-lightbox__image").boundingBox();
  expect(mobileViewportBox).not.toBeNull();
  expect(mobileImageBox).not.toBeNull();
  expect(
    Math.abs(
      (mobileImageBox?.y ?? 0) +
        (mobileImageBox?.height ?? 0) / 2 -
        ((mobileViewportBox?.y ?? 0) + (mobileViewportBox?.height ?? 0) / 2),
    ),
  ).toBeLessThan(24);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("lightbox closes through its semantic X and backdrop while keeping focus inside", async ({
  page,
}) => {
  seedNavigationPostFixture();
  await page.goto("/");
  await waitForUiReady(page);

  const card = page.locator(".product-post", { hasText: "E2E navigation post" });
  const trigger = card.getByRole("button", { name: "Preview image" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Image viewer" });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  await close.focus();

  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() =>
        page
          .locator(".sb-overlay-viewport")
          .evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true);
  }

  await close.click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.locator(".sb-overlay-backdrop").click({ position: { x: 8, y: 8 } });
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("discovery image views use the shared lightbox", async ({ page }) => {
  await page.route("**/api/media/post/e2e-category-anime-media", (route) =>
    route.fulfill({ status: 200, contentType: "image/svg+xml", body: IMAGE }),
  );
  seedCategoryBadgeFixture();

  for (const view of ["gallery", "grid"]) {
    await page.goto(`/search?q=E2E&kind=posts&category=anime&view=${view}`);
    await waitForUiReady(page);

    const result = page.locator("[data-search-post-id=e2e-category-anime-post]");
    const trigger = result.getByRole("button", { name: "Preview image" });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Image viewer" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".product-media-lightbox__image")).toHaveAttribute(
      "src",
      "/api/media/post/e2e-category-anime-media",
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
});
