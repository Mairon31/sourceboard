import { expect, test } from "@playwright/test";
import { seedCategoryBadgeFixture } from "./category-fixture";
import { waitForUiReady } from "./test-helpers";

test(
  "Discovery controls preserve applicable URL state and strip category for Users",
  async ({ page }) => {
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
  },
);
