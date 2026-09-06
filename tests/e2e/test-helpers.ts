import { expect, type Page } from "@playwright/test";

export async function waitForUiReady(page: Page) {
  await expect(page.locator('[data-ui-ready="true"]')).toBeVisible();
}
