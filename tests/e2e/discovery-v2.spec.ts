import { expect, test, type Page } from "@playwright/test";
import { seedCategoryBadgeFixture } from "./category-fixture";
import { waitForUiReady } from "./test-helpers";

async function searchResultIds(page: Page) {
  return page.locator("[data-search-post-id]").evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute("data-search-post-id"))
      .filter((value): value is string => Boolean(value)),
  );
}

test("Discovery preserves URL state and strips category for Users", async ({ page }) => {
  seedCategoryBadgeFixture();
  await page.goto("/search?q=E2E&kind=posts&filter=verified&category=anime&view=gallery");
  await waitForUiReady(page);

  await expect(page.getByRole("link", { name: "Gallery view" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("link", { name: "Recent" }).click();
  await expect(page).toHaveURL(/\/search\?q=E2E&kind=posts&category=anime&view=gallery$/);

  await page.getByRole("link", { name: "Users" }).click();
  await expect(page).toHaveURL(/\/search\?q=E2E&kind=profiles$/);
  expect(new URL(page.url()).searchParams.has("category")).toBe(false);
  expect(new URL(page.url()).searchParams.has("view")).toBe(false);
});

test("Discovery switches List, Gallery and Detailed Grid over the same results", async ({
  page,
}) => {
  seedCategoryBadgeFixture();
  await page.goto("/search?q=E2E&kind=posts&category=anime&view=list");
  await waitForUiReady(page);

  const listIds = await searchResultIds(page);
  expect(listIds.length).toBeGreaterThan(0);

  await page.getByRole("link", { name: "Gallery view" }).click();
  await expect(page).toHaveURL(/view=gallery/);
  const galleryIds = await searchResultIds(page);
  expect(galleryIds).toEqual(listIds);

  const firstGalleryItem = page.locator(".product-search-gallery__item").first();
  const galleryBounds = await firstGalleryItem.boundingBox();
  expect(galleryBounds).not.toBeNull();
  expect(
    Math.abs((galleryBounds?.width ?? 0) - (galleryBounds?.height ?? 0)),
  ).toBeLessThanOrEqual(2);

  await firstGalleryItem.focus();
  await expect(firstGalleryItem.locator(".product-search-gallery__overlay")).toBeVisible();
  await expect(firstGalleryItem.getByText("Anime", { exact: true })).toBeVisible();
  await expect(firstGalleryItem.getByText(/open|answered|verified/i).first()).toBeVisible();
  await expect(firstGalleryItem.getByLabel("Post engagement")).toBeVisible();

  await page.getByRole("link", { name: "Detailed Grid view" }).click();
  await expect(page).toHaveURL(/view=grid/);
  const gridIds = await searchResultIds(page);
  expect(gridIds).toEqual(listIds);

  const animeCard = page.locator(
    '[data-search-view="grid"] [data-search-post-id="e2e-category-anime-post"]',
  );
  await expect(animeCard.getByText("E2E Anime category post", { exact: true })).toBeVisible();
  await expect(animeCard.getByText("E2E Category User", { exact: true })).toBeVisible();
});
