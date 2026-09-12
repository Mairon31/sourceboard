import { expect, test, type APIRequestContext } from "@playwright/test";
import { seedNavigationPostFixture } from "./test-helpers";

const ORIGIN = "http://localhost:5173";

async function createNavigationPostShare(request: APIRequestContext): Promise<string> {
  const response = await request.post("/api/share-links", {
    headers: { origin: ORIGIN },
    data: {
      resourceType: "POST",
      resourceId: "e2e-navigation-post",
    },
  });
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { shortUrl?: string };
  expect(payload.shortUrl).toMatch(/^\/sh\/[0-9A-Za-z]{10}$/);
  return payload.shortUrl as string;
}

test.describe("stable share links", () => {
  test.beforeAll(() => {
    seedNavigationPostFixture();
  });

  test("SSR response exposes unfurl metadata before client navigation", async ({ request }) => {
    const shortUrl = await createNavigationPostShare(request);
    const response = await request.get(`${shortUrl}?lang=es`);
    expect(response.status()).toBe(200);

    const html = await response.text();
    expect(html).toContain('name="robots" content="noindex, follow"');
    expect(html).toContain('property="og:title" content="E2E navigation post"');
    expect(html).toMatch(
      /rel="canonical" href="http:\/\/localhost:5173\/posts\/e2e-navigation-post\/e2e-navigation-post"/,
    );
    expect(html).toContain("Continue to SourceBoard");
  });

  test("browser follows the short link and preserves a supported locale", async ({
    page,
    request,
  }) => {
    const shortUrl = await createNavigationPostShare(request);
    await page.goto(`${shortUrl}?lang=es`);
    await expect(page).toHaveURL(/\/posts\/e2e-navigation-post\/e2e-navigation-post\?lang=es$/);
    await expect(page.getByRole("link", { name: "E2E navigation post" }).first()).toBeVisible();
  });

  test("missing short IDs return an unavailable response without target metadata", async ({
    request,
  }) => {
    const response = await request.get("/sh/0000000000");
    expect(response.status()).toBe(404);
    const html = await response.text();
    expect(html).toContain('class="product-not-found"');
    expect(html).toContain("product-not-found-title");
    expect(html).not.toContain("E2E navigation post");
    expect(html).not.toContain('property="og:title" content="E2E navigation post"');
  });
});
