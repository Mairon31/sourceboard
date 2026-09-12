import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hashOpaqueToken } from "../../worker/auth/crypto";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../worker/auth/security";
import { seedNavigationPostFixture, waitForUiReady } from "./test-helpers";

const IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='100' viewBox='0 0 160 100'%3E%3Crect width='160' height='100' rx='12' fill='%237c3aed'/%3E%3C/svg%3E";
const STICKER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Ccircle cx='48' cy='48' r='34' fill='%2322c55e'/%3E%3C/svg%3E";
const EMOTE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='28' fill='%23f59e0b'/%3E%3C/svg%3E";

function executeLocalSql(sql: string) {
  const wranglerEntrypoint = resolve(
    process.cwd(),
    "node_modules",
    "wrangler",
    "bin",
    "wrangler.js",
  );
  execFileSync(
    process.execPath,
    [wranglerEntrypoint, "d1", "execute", "DB", "--local", "--command", sql],
    { cwd: process.cwd(), stdio: "pipe" },
  );
}

async function installSession(page: Page) {
  const now = Date.now();
  const sessionId = "e2e-media-picker-layout-session";
  const sessionToken = "sourceboard-e2e-media-picker-layout-session";
  const csrfToken = "sourceboard-e2e-media-picker-layout-csrf";
  const tokenHash = hashOpaqueToken(sessionToken);
  const expiresAt = now + 24 * 60 * 60 * 1000;

  executeLocalSql(`
    DELETE FROM sessions WHERE id = '${sessionId}' OR token_hash = '${tokenHash}';
    INSERT INTO sessions
      (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at,
       ip_prefix_hash, user_agent_hash)
    VALUES
      ('${sessionId}', 'e2e-navigation-user', '${tokenHash}', ${now}, ${now},
       ${expiresAt}, NULL, NULL, NULL);
  `);

  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      url: "https://localhost:5173",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: CSRF_COOKIE_NAME,
      value: csrfToken,
      url: "https://localhost:5173",
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}

async function mockMediaApis(page: Page) {
  await page.route("**/api/comments/media/search?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const type = requestUrl.searchParams.get("type");
    const isSticker = type === "STICKER";
    const items = Array.from({ length: 8 }, (_, index) => ({
      id: `e2e-${isSticker ? "sticker" : "gif"}-${index}`,
      title: `${isSticker ? "Sticker" : "GIF"} ${index}`,
      label: `${isSticker ? "Sticker" : "GIF"} ${index}`,
      url: isSticker ? STICKER : IMAGE,
      preview: isSticker ? STICKER : IMAGE,
      type: isSticker ? "STICKER" : "GIF",
      provider: "klipy",
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items }),
    });
  });

  await page.route("**/api/comments/stickers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        packs: [
          {
            id: "e2e-sticker-pack",
            label: "E2E Stickers",
            stickers: Array.from({ length: 5 }, (_, index) => ({
              id: `e2e-owned-sticker-${index}`,
              label: `Owned sticker ${index}`,
              url: STICKER,
              preview: STICKER,
              type: "STICKER",
              provider: "sourceboard",
              packId: "e2e-sticker-pack",
              isAnimated: false,
            })),
          },
        ],
      }),
    });
  });

  await page.route("**/api/comments/emotes", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        packs: [
          {
            id: "e2e-emote-pack",
            label: "E2E Emotes",
            emotes: Array.from({ length: 10 }, (_, index) => ({
              id: `e2e-emote-${index}`,
              label: `Emote ${index}`,
              shortcode: `e2e_emote_${index}`,
              url: EMOTE,
              type: "EMOTE",
              packId: "e2e-emote-pack",
            })),
          },
        ],
      }),
    });
  });
}

async function expectSquareNonOverlapping(page: Page, selector: string) {
  const boxes = await page.locator(selector).evaluateAll((nodes) =>
    nodes.slice(0, 6).map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
  expect(boxes.length).toBeGreaterThan(1);
  for (const box of boxes) {
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1.5);
  }
  for (let index = 0; index < boxes.length; index += 1) {
    for (let other = index + 1; other < boxes.length; other += 1) {
      const a = boxes[index];
      const b = boxes[other];
      const overlaps =
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlaps).toBe(false);
    }
  }
}

async function expectPickerWithinViewport(page: Page, viewportHeight: number) {
  const picker = page.locator(".product-comment-media-picker");
  await expect
    .poll(async () => {
      const box = await picker.boundingBox();
      return box ? box.y + box.height : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(viewportHeight + 1);
}

async function openPost(page: Page) {
  const response = await page.goto("/posts/e2e-navigation-post/e2e-navigation-post");
  expect(response?.status()).toBe(200);
  await waitForUiReady(page);
  await expect(page.getByLabel("Add a comment")).toBeVisible();
}

test.beforeAll(() => {
  seedNavigationPostFixture();
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
]) {
  test(`media picker stays stable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installSession(page);
    await mockMediaApis(page);
    await openPost(page);

    const composer = page.locator(".product-comment-composer");

    await page.getByRole("button", { name: "GIF", exact: true }).click();
    const picker = page.locator('.product-comment-media-picker [data-media-kind="gif"]');
    await expect(picker).toBeVisible();
    await expect(picker.locator("button").first()).toBeVisible();
    await expectPickerWithinViewport(page, viewport.height);
    const composerTopAfterOpen = (await composer.boundingBox())?.y;
    const gifBoxes = await picker.locator("button").evaluateAll((nodes) =>
      nodes.slice(0, 6).map((node) => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    );
    expect(gifBoxes.every((box) => box.width > 0 && box.height > 0)).toBe(true);

    await picker
      .locator("img")
      .first()
      .evaluate((image) => {
        const element = image as HTMLImageElement;
        if (element.complete) return;
        return new Promise<void>((resolve) => {
          element.addEventListener("load", () => resolve(), { once: true });
          element.addEventListener("error", () => resolve(), { once: true });
        });
      });
    await page.waitForTimeout(100);
    await expectPickerWithinViewport(page, viewport.height);
    expect((await composer.boundingBox())?.y).toBeCloseTo(composerTopAfterOpen ?? 0, 0);

    await page.getByRole("tab", { name: "Stickers" }).click();
    const stickerSurface = page.locator(
      '.product-comment-media-picker [data-media-kind="sticker"]',
    );
    await expect(stickerSurface).toBeVisible();
    const stickerButtons = stickerSurface.locator(
      ".product-comment-media-picker__results--sticker button",
    );
    await expect(stickerButtons.first()).toBeVisible();
    await expectPickerWithinViewport(page, viewport.height);
    await expectSquareNonOverlapping(
      page,
      '[data-media-kind="sticker"] .product-comment-media-picker__results--sticker button',
    );
    await expect(stickerSurface.locator("img").first()).toHaveCSS("object-fit", "contain");

    await page.getByRole("tab", { name: "Emotes" }).click();
    const emoteSurface = page.locator('.product-comment-media-picker [data-media-kind="emote"]');
    await expect(emoteSurface).toBeVisible();
    const emoteButtons = emoteSurface.locator(".product-comment-media-picker__emote-grid button");
    await expect(emoteButtons.first()).toBeVisible();
    await expectPickerWithinViewport(page, viewport.height);
    await expectSquareNonOverlapping(
      page,
      '[data-media-kind="emote"] .product-comment-media-picker__emote-grid button',
    );
    await expect(emoteSurface.locator("img").first()).toHaveCSS("object-fit", "contain");
  });
}
