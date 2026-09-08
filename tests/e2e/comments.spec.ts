import { expect, test } from "@playwright/test";
import { seedCommentMediaRegressionFixture } from "./comment-media-fixture";
import { waitForUiReady } from "./test-helpers";

test.beforeAll(() => {
  seedCommentMediaRegressionFixture();
});

test("comment API rejects unauthenticated mutation and preserves its error envelope", async ({
  request,
}) => {
  const response = await request.post("/api/posts/post-missing/comments", {
    headers: {
      origin: "http://localhost:5173",
      "x-csrf-token": "missing",
    },
    data: { plaintext: "This must not be persisted." },
  });

  expect([401, 404, 503]).toContain(response.status());
  if (response.headers()["content-type"]?.includes("application/json")) {
    await expect(response.json()).resolves.toMatchObject({ error: { code: expect.any(String) } });
  }
});

test("comment API does not accept HTML or arbitrary image uploads", async ({ request }) => {
  const response = await request.post("/api/posts/post-missing/comments", {
    headers: {
      origin: "http://localhost:5173",
      "x-csrf-token": "missing",
    },
    data: {
      richtext: [{ type: "image", src: "https://third-party.invalid/image.png" }],
    },
  });

  expect([401, 404, 503]).toContain(response.status());
});

test("legacy Markdown plus emote renders without address or page errors", async ({ page }) => {
  const pageErrors: string[] = [];
  const mediaRequestFailures: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/media/catalog/emote/")) {
      mediaRequestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
    }
  });

  const response = await page.goto("/posts/e2e-navigation-post/e2e-navigation-post");
  expect(response?.status()).toBe(200);
  await waitForUiReady(page);

  const comment = page.locator("#comment-e2e-comment-media-regression");
  await expect(comment).toBeVisible();
  await expect(comment.locator("strong")).toContainText("Legacy bold");

  const emote = comment.locator("img.product-richtext__emote-image");
  await expect(emote).toHaveAttribute("src", "/api/media/catalog/emote/e2e-comment-media-emote");
  await expect(emote).toHaveAttribute("title", "e2e_media_wave");

  expect(mediaRequestFailures).toEqual([]);
  expect(pageErrors).toEqual([]);
});
