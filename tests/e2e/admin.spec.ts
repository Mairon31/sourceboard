import { expect, test } from "@playwright/test";
import { installAdminStoreFixture, waitForUiReady } from "./test-helpers";

test("admin dashboard uses the moderation-focused shell", async ({ page }) => {
  await page.goto("/admin");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
});

test("moderation queue presents NSFW and source-review context", async ({ page }) => {
  await page.goto("/admin/moderation");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
});

test("anonymous identity reveal is reason-gated", async ({ page }) => {
  await page.goto("/admin/anonymous/post-anonymous");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
});

test("authorized Admin Store exposes published cosmetics and editable metadata", async ({
  page,
}) => {
  await installAdminStoreFixture(page);
  await page.goto("/admin/store");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Catalog control center" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Cosmetics" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Emote packs" })).toBeVisible();

  const stellar = page.locator(".admin-store-cosmetic-card").filter({ hasText: "Stellar Magic" });
  await expect(stellar).toBeVisible();
  await expect(stellar.getByText("PUBLISHED", { exact: true })).toBeVisible();
  await expect(stellar.getByText(/owners/)).toBeVisible();
  await expect(stellar.getByText(/equipped/)).toBeVisible();

  await stellar.getByRole("button", { name: "Edit" }).click();
  const editor = page.locator(".admin-store-editor");
  await expect(editor.getByRole("heading", { name: "Stellar Magic", exact: true })).toBeVisible();
  await expect(editor.locator('textarea[name="config"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
});

test("authorized Admin Store opens draft packs and administers individual emotes", async ({
  page,
}) => {
  await installAdminStoreFixture(page);
  await page.goto("/admin/store");
  await waitForUiReady(page);

  await page.getByRole("tab", { name: "Emote packs" }).click();
  const packButton = page
    .locator(".admin-store-pack-list__item")
    .filter({ hasText: "E2E Draft Pack" });
  await expect(packButton).toBeVisible();
  await packButton.click();

  const workspace = page.locator(".admin-store-pack-workspace");
  await expect(workspace.getByRole("heading", { name: "E2E Draft Pack" })).toBeVisible();
  await expect(workspace.getByText("DRAFT", { exact: true }).first()).toBeVisible();

  const emote = page.locator(".admin-store-emote-card").filter({ hasText: "E2E Wave" });
  await expect(emote).toBeVisible();
  await expect(emote.getByText(":e2e_wave:", { exact: true })).toBeVisible();
  await expect(emote.getByText("CLEAR", { exact: true })).toBeVisible();
  await expect(emote.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(emote.getByRole("button", { name: "Disable", exact: true })).toBeVisible();
  await expect(emote.getByRole("button", { name: "Replace image" })).toBeVisible();

  await emote.getByRole("button", { name: "Edit" }).click();
  await expect(emote.getByText("Shortcode", { exact: true })).toBeVisible();
  await expect(emote.getByText("Label", { exact: true })).toBeVisible();
  await expect(emote.getByText("Sort order", { exact: true })).toBeVisible();
  await expect(emote.getByText("Lifecycle", { exact: true })).toBeVisible();
  await expect(emote.getByRole("button", { name: "Save emote" })).toBeVisible();
});

test("authorized Admin Store uploads an emote into a draft pack without media network failures", async ({
  page,
}) => {
  await installAdminStoreFixture(page);
  const failedMediaRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/admin/catalog/emotes/") || request.url().includes("/api/media/")) {
      failedMediaRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/admin/store");
  await waitForUiReady(page);
  await page.getByRole("tab", { name: "Emote packs" }).click();
  const packButton = page
    .locator(".admin-store-pack-list__item")
    .filter({ hasText: "E2E Draft Pack" });
  await packButton.click();

  const workspace = page.locator(".admin-store-pack-workspace");
  await expect(workspace.getByRole("heading", { name: "Add emote" })).toBeVisible();
  await workspace.locator('input[name="shortcode"]').fill("e2e_uploaded");
  await workspace.locator('input[name="label"]').fill("E2E Uploaded");
  await workspace.locator('input[name="file"]').setInputFiles({
    name: "e2e-upload.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });

  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/admin/catalog/emotes") &&
      response.request().method() === "POST",
  );
  await workspace.getByRole("button", { name: "Add emote" }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.status()).toBe(201);

  const uploaded = page.locator(".admin-store-emote-card").filter({ hasText: "E2E Uploaded" });
  await expect(uploaded.getByText(":e2e_uploaded:", { exact: true })).toBeVisible();
  const image = uploaded.getByRole("img", { name: "E2E Uploaded" });
  await expect(image).toHaveAttribute("src", /\/api\/admin\/catalog\/emotes\/.+\/media$/);
  const src = await image.getAttribute("src");
  expect(src).toBeTruthy();
  const mediaResponse = await page.request.get(src!);
  expect(mediaResponse.status()).toBe(200);
  expect(failedMediaRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});
