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

test("authorized Admin Store edits cosmetics through Creator Pro and rejects unsafe duration", async ({
  page,
}) => {
  await installAdminStoreFixture(page);
  await page.goto("/admin/store");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Catalog control center" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Catalog" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Emote Packs" })).toBeVisible();

  const stellar = page.locator(".admin-store-cosmetic-card").filter({ hasText: "Stellar Magic" });
  await expect(stellar).toBeVisible();
  await expect(stellar.getByText("PUBLISHED", { exact: true })).toBeVisible();
  await expect(stellar.getByText(/owners/)).toBeVisible();
  await expect(stellar.getByText(/equipped/)).toBeVisible();

  await stellar.getByRole("button", { name: "Edit" }).click();
  const editor = page.locator(".admin-store-editor");
  await expect(editor.getByRole("heading", { name: "Stellar Magic", exact: true })).toBeVisible();
  await expect(editor.getByLabel("Canonical cosmetic preview")).toBeVisible();
  const creatorPro = editor.getByRole("region", { name: "Creator Pro cosmetic editor" });
  await expect(creatorPro).toBeVisible();
  await expect(editor.locator('textarea[name="config"]')).toHaveCount(0);

  await creatorPro.getByRole("button", { name: "Clone preset" }).click();
  await creatorPro.getByLabel("Primary color").fill("#2255aa");
  await creatorPro.getByLabel("Duration (ms)").fill("12000");
  await expect(creatorPro.getByText("Valid schema v1")).toBeVisible();

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/store/") &&
      response.request().method() === "PATCH",
  );
  await editor.getByRole("button", { name: "Save changes" }).click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);

  const validBody = saveResponse.request().postDataJSON() as {
    name: string;
    description: string;
    pricePoints: number;
    sortOrder: number;
    config: Record<string, unknown> & {
      animation?: Record<string, unknown>;
    };
  };
  const invalidResponse = await page.request.patch(new URL(saveResponse.url()).pathname, {
    headers: { "x-csrf-token": "sourceboard-e2e-admin-csrf-token" },
    data: {
      ...validBody,
      config: {
        ...validBody.config,
        animation: { ...validBody.config.animation, durationMs: 61_000 },
      },
    },
  });
  expect(invalidResponse.status()).toBe(400);
});

test("authorized Admin Store opens draft packs and administers individual emotes", async ({
  page,
}) => {
  await installAdminStoreFixture(page);
  await page.goto("/admin/store");
  await waitForUiReady(page);

  await page.getByRole("tab", { name: "Emote Packs" }).click();
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
}, testInfo) => {
  await installAdminStoreFixture(page);
  const uploadShortcode = `e2e_uploaded_${testInfo.retry}_${Date.now().toString(36)}`;
  const failedMediaRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on("requestfailed", (request) => {
    if (
      request.url().includes("/api/admin/catalog/emotes/") ||
      request.url().includes("/api/media/")
    ) {
      failedMediaRequests.push(
        `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`,
      );
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/admin/store");
  await waitForUiReady(page);
  await expect(page.getByRole("heading", { name: "Catalog control center" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("tab", { name: "Emote Packs" }).click();
  const packButton = page
    .locator(".admin-store-pack-list__item")
    .filter({ hasText: "E2E Draft Pack" });
  await expect(packButton).toBeVisible({ timeout: 30_000 });
  await packButton.click();

  const workspace = page.locator(".admin-store-pack-workspace");
  await expect(workspace.getByRole("heading", { name: "Add emote" })).toBeVisible();
  await workspace.locator('input[name="shortcode"]').fill(uploadShortcode);
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
  expect(pageErrors).toEqual([]);
  const created = (await createResponse.json()) as { id?: string };
  expect(created.id).toBeTruthy();

  const detailResponse = await page.request.get(
    "/api/admin/catalog/emote-packs/e2e-admin-draft-pack",
  );
  expect(detailResponse.status()).toBe(200);
  const detailPayload = (await detailResponse.json()) as {
    pack?: { emotes?: Array<{ shortcode?: string }> };
  };
  expect(detailPayload.pack?.emotes?.some((emote) => emote.shortcode === uploadShortcode)).toBe(
    true,
  );

  const directMediaResponse = await page.request.get(
    `/api/admin/catalog/emotes/${encodeURIComponent(created.id!)}/media`,
  );
  expect(directMediaResponse.status()).toBe(200);

  const uploaded = page
    .locator(".admin-store-emote-card")
    .filter({ hasText: `:${uploadShortcode}:` });
  await expect(uploaded.getByText(`:${uploadShortcode}:`, { exact: true })).toBeVisible();
  const image = uploaded.getByRole("img", { name: "E2E Uploaded" });
  await expect(image).toHaveAttribute("src", /\/api\/admin\/catalog\/emotes\/.+\/media$/);
  const src = await image.getAttribute("src");
  expect(src).toBeTruthy();
  const mediaResponse = await page.request.get(src!);
  expect(mediaResponse.status()).toBe(200);
  expect(failedMediaRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});
