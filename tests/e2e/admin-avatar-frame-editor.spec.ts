import { expect, test } from "@playwright/test";
import { installAdminStoreFixture, waitForUiReady } from "./test-helpers";

test.use({ viewport: { width: 390, height: 844 } });

test("admin edits an avatar frame preset and safe CSS without mobile overflow", async ({
  page,
}) => {
  await installAdminStoreFixture(page);
  await page.goto("/admin/store");
  await waitForUiReady(page);

  const stellar = page.locator(".admin-store-cosmetic-card").filter({ hasText: "Stellar Magic" });
  await stellar.getByRole("button", { name: "Edit" }).click();

  const editor = page.locator(".admin-store-editor");
  const creatorPro = editor.getByRole("region", { name: "Creator Pro cosmetic editor" });
  await expect(creatorPro.getByLabel("Frame preset")).toHaveValue("stellar");
  const css = creatorPro.getByLabel("Safe frame CSS");
  await expect(css).toBeVisible();

  await creatorPro.getByLabel("Frame preset").selectOption("neon-light");
  await css.fill(
    ".cosmetic-root .product-avatar-stage__part { border-width: 4px; border-color: #ff4d6d; }",
  );
  await expect(creatorPro.getByText("CSS passes the safety checks")).toBeVisible();
  await expect(editor.locator('[data-avatar-frame="neon-light"]')).toBeVisible();
  await expect(
    editor.locator('[data-avatar-frame="neon-light"] .product-avatar-stage__part').first(),
  ).toHaveCSS("border-top-color", "rgb(255, 77, 109)");

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/admin-avatar-frame-editor-mobile.png",
    fullPage: true,
  });

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/store/") && response.request().method() === "PATCH",
  );
  await editor.getByRole("button", { name: "Save changes" }).click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);
  const requestBody = saveResponse.request().postDataJSON() as {
    config?: Record<string, unknown>;
  };
  expect(requestBody.config).toMatchObject({
    preset: "neon-light",
    communityCosmeticId: "store-frame-stellar",
  });
  expect(requestBody.config?.communityCssSource).toContain("border-width: 4px");
  expect(requestBody.config?.communityCss).toContain(
    '[data-community-cosmetic~="store-frame-stellar"]',
  );

  const reopened = page.locator(".admin-store-cosmetic-card").filter({ hasText: "Stellar Magic" });
  await reopened.getByRole("button", { name: "Edit" }).click();
  const reopenedEditor = page.locator(".admin-store-editor");
  await expect(reopenedEditor.getByLabel("Frame preset")).toHaveValue("neon-light");
  await expect(reopenedEditor.getByLabel("Safe frame CSS")).toHaveValue(
    ".cosmetic-root .product-avatar-stage__part { border-width: 4px; border-color: #ff4d6d; }",
  );
});

test("public Store renders the new frame presets on mobile", async ({ page }) => {
  await page.goto("/store");
  await waitForUiReady(page);

  const orange = page
    .locator(".product-store-item")
    .filter({ has: page.getByRole("heading", { name: "Orange", exact: true }) });
  const vx = page
    .locator(".product-store-item")
    .filter({ has: page.getByRole("heading", { name: "VX", exact: true }) });
  await expect(orange).toBeVisible();
  await expect(vx).toBeVisible();
  await expect(orange.locator('[data-avatar-frame="orange"]')).toBeVisible();
  await expect(vx.locator('[data-avatar-frame="vx"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/public-frame-presets-mobile.png",
    fullPage: true,
  });
});
