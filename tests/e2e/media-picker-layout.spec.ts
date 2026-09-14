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

async function mockInteractiveMediaApis(page: Page, requests: string[]) {
  await page.route("**/api/comments/media/search?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const type = requestUrl.searchParams.get("type") ?? "GIF";
    const query = requestUrl.searchParams.get("q") ?? "";
    const pos = requestUrl.searchParams.get("pos") ?? "";
    requests.push(`${type}:${query}:${pos}`);
    if (query === "slow") {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "slow-result",
              title: "Slow result",
              label: "Slow result",
              url: IMAGE,
              preview: IMAGE,
              type: "GIF",
              provider: "klipy",
            },
          ],
          next: null,
        }),
      });
      return;
    }
    if (query === "fast") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "fast-result",
              title: "Fast result",
              label: "Fast result",
              url: IMAGE,
              preview: IMAGE,
              type: "GIF",
              provider: "klipy",
            },
          ],
          next: null,
        }),
      });
      return;
    }
    const isSticker = type === "STICKER";
    const pageItems = isSticker
      ? [
          {
            id: "interactive-sticker",
            title: "Interactive sticker",
            label: "Interactive sticker",
            url: STICKER,
            preview: STICKER,
            type: "STICKER",
            provider: "klipy",
          },
        ]
      : pos
        ? [
            {
              id: "interactive-gif-2",
              title: "Interactive GIF duplicate",
              label: "Interactive GIF duplicate",
              url: IMAGE,
              preview: IMAGE,
              type: "GIF",
              provider: "klipy",
            },
            {
              id: "interactive-gif-3",
              title: "Interactive GIF 3",
              label: "Interactive GIF 3",
              url: IMAGE,
              preview: IMAGE,
              type: "GIF",
              provider: "klipy",
            },
          ]
        : [
            {
              id: "interactive-gif-1",
              title: "Interactive GIF 1",
              label: "Interactive GIF 1",
              url: IMAGE,
              preview: IMAGE,
              type: "GIF",
              provider: "klipy",
            },
            {
              id: "interactive-gif-2",
              title: "Interactive GIF 2",
              label: "Interactive GIF 2",
              url: IMAGE,
              preview: IMAGE,
              type: "GIF",
              provider: "klipy",
            },
          ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: pageItems, next: !isSticker && !pos ? "cursor-2" : null }),
    });
  });
  await page.route("**/api/comments/stickers", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"packs":[]}' });
  });
  await page.route("**/api/comments/emotes", async (route) => {
    const packs = Array.from({ length: 3 }, (_, packIndex) => ({
      id: `interactive-pack-${packIndex}`,
      label: `Interactive Pack ${packIndex + 1}`,
      emotes: Array.from({ length: 24 }, (_, index) => ({
        id: `interactive-emote-${packIndex}-${index}`,
        label: `Interactive emote ${packIndex + 1}-${index + 1}`,
        shortcode: `interactive_${packIndex}_${index}`,
        url: EMOTE,
        type: "EMOTE",
        packId: `interactive-pack-${packIndex}`,
      })),
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ packs }),
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

test("media picker paginates, replaces attachments and keeps multi-emote insertion state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installSession(page);
  const requests: string[] = [];
  await mockInteractiveMediaApis(page, requests);
  await openPost(page);

  const composer = page.getByLabel("Add a comment");
  await composer.fill("left right");
  await page.getByRole("button", { name: "GIF", exact: true }).click();
  const gifSurface = page.locator('[data-media-kind="gif"]');
  await expect(gifSurface).toBeVisible();
  await expect.poll(() => requests.some((request) => request.endsWith(":cursor-2"))).toBe(true);
  await expect(gifSurface.locator("button")).toHaveCount(3);

  await page.getByRole("button", { name: "Add Interactive GIF 1" }).click();
  await expect(page.locator(".product-comment-attachment--gif")).toHaveCount(1);
  await expect(composer).toHaveValue("left right");
  await page.getByRole("button", { name: "Remove GIF" }).click();
  await expect(page.locator(".product-comment-attachment")).toHaveCount(0);
  await expect(composer).toHaveValue("left right");

  await page.getByRole("button", { name: "GIF", exact: true }).click();
  await page.getByRole("button", { name: "Add Interactive GIF 1" }).click();
  await page.getByRole("button", { name: "Sticker", exact: true }).click();
  await page.getByRole("button", { name: "Add Interactive sticker" }).click();
  await expect(page.locator(".product-comment-attachment")).toHaveCount(1);
  await expect(page.locator(".product-comment-attachment--sticker")).toBeVisible();
  await expect(page.locator(".product-comment-attachment--gif")).toHaveCount(0);
  await page.getByRole("button", { name: "Remove sticker" }).click();

  await page.getByRole("button", { name: "GIF", exact: true }).click();
  const searchGif = page.getByLabel("Search GIFs");
  await searchGif.fill("slow");
  await page.waitForTimeout(300);
  await searchGif.fill("fast");
  await expect(page.getByRole("button", { name: "Add Fast result" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Slow result" })).toHaveCount(0);
  await expect(searchGif).toHaveValue("fast");
  await page.getByRole("button", { name: "Close media picker" }).click();

  await composer.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(4, 4);
  });
  await page.getByRole("button", { name: "Emote", exact: true }).click();
  const emoteSurface = page.locator('[data-media-kind="emote"]');
  await expect(emoteSurface).toBeVisible();
  const packButtons = page.locator(".product-comment-media-picker__packbar > button");
  await expect(packButtons).toHaveCount(3);
  const beforePackScroll = await emoteSurface.evaluate((element) => element.scrollTop);
  await packButtons.nth(1).click();
  await expect(packButtons.nth(1)).toHaveClass(/is-active/);
  await expect
    .poll(async () => emoteSurface.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(beforePackScroll);

  const emoteSearch = page.getByLabel("Search emotes");
  await emoteSearch.fill("Interactive emote");
  await page.getByRole("button", { name: "Add Interactive emote 2-1", exact: true }).click();
  await expect(page.locator(".product-comment-media-picker")).toBeVisible();
  await expect(emoteSearch).toHaveValue("Interactive emote");
  await page.getByRole("button", { name: "Add Interactive emote 2-2", exact: true }).click();
  await expect(page.locator(".product-comment-media-picker")).toBeVisible();
  await expect(composer).toHaveValue(/:interactive_1_0:.*:interactive_1_1:/);

  await emoteSearch.clear();
  await expect(emoteSearch).toHaveValue("");
  await expect(emoteSurface.locator("[data-pack-id]")).toHaveCount(3);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await emoteSurface.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect(packButtons.nth(2)).toHaveClass(/is-active/, { timeout: 10_000 });
  const packbarBox = await page.locator(".product-comment-media-picker__packbar").boundingBox();
  const activeBox = await packButtons.nth(2).boundingBox();
  expect(activeBox?.x ?? 0).toBeGreaterThanOrEqual((packbarBox?.x ?? 0) - 1);
  expect((activeBox?.x ?? 0) + (activeBox?.width ?? 0)).toBeLessThanOrEqual(
    (packbarBox?.x ?? 0) + (packbarBox?.width ?? 0) + 1,
  );
});
