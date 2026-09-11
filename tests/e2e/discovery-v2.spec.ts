import { expect, test, type Page } from "@playwright/test";
import { seedCategoryBadgeFixture } from "./category-fixture";
import { waitForUiReady } from "./test-helpers";

async function searchResultIds(page: Page) {
  const cards = page.locator("[data-search-post-id]");
  return cards.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-search-post-id") ?? ""),
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

test("Discovery keeps result identity across views", async ({ page }) => {
  seedCategoryBadgeFixture();
  await page.goto("/search?q=E2E&kind=posts&category=anime&view=list");
  await waitForUiReady(page);

  const listIds = await searchResultIds(page);
  expect(listIds.length).toBeGreaterThan(0);

  await page.getByRole("link", { name: "Gallery view" }).click();
  await expect(page).toHaveURL(/view=gallery/);
  const galleryIds = await searchResultIds(page);
  expect(galleryIds).toEqual(listIds);

  const galleryItem = page.locator(".product-search-gallery__item").first();
  const bounds = await galleryItem.boundingBox();
  expect(bounds).not.toBeNull();
  const squareDelta = Math.abs((bounds?.width ?? 0) - (bounds?.height ?? 0));
  expect(squareDelta).toBeLessThanOrEqual(2);

  await galleryItem.focus();
  await expect(galleryItem.locator(".product-search-gallery__overlay")).toBeVisible();
  await expect(galleryItem.getByText("Anime", { exact: true })).toBeVisible();
  await expect(galleryItem.getByText(/open|answered|verified/i).first()).toBeVisible();
  await expect(galleryItem.getByLabel("Post engagement")).toBeVisible();

  await page.getByRole("link", { name: "Detailed Grid view" }).click();
  await expect(page).toHaveURL(/view=grid/);
  const gridIds = await searchResultIds(page);
  expect(gridIds).toEqual(listIds);

  const animeCard = page.locator(".product-search-grid-card").filter({
    hasText: "E2E Anime category post",
  });
  await expect(animeCard.getByText("E2E Anime category post", { exact: true })).toBeVisible();
  await expect(animeCard.getByText("E2E Category User", { exact: true })).toBeVisible();
});

test("Discovery persists view preference without overriding an explicit URL view", async ({ page }) => {
  seedCategoryBadgeFixture();
  const baseSearch = "/search?q=E2E&kind=posts&category=anime";

  await page.goto(baseSearch);
  await waitForUiReady(page);
  await page.getByRole("link", { name: "Gallery view" }).click();
  await expect(page).toHaveURL(/view=gallery/);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("sourceboard.search.view")))
    .toBe("gallery");

  await page.goto(baseSearch);
  await waitForUiReady(page);
  await expect(page).toHaveURL(/view=gallery/);
  await expect(page.getByRole("link", { name: "Gallery view" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.goto(`${baseSearch}&view=list`);
  await waitForUiReady(page);
  await expect(page).toHaveURL(/view=list/);
  await expect(page.getByRole("link", { name: "List view" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
