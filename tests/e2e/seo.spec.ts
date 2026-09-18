import { expect, test } from "@playwright/test";

test("robots exposes the canonical public sitemap and excludes private product routes", async ({
  request,
}) => {
  const response = await request.get("/robots.txt");

  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("Disallow: /admin/");
  expect(body).toContain("Disallow: /settings");
  expect(body).toContain("Disallow: /notifications");
  expect(body).toContain("Sitemap: https://srcboard.me/sitemap.xml");
  expect(body).not.toContain("Disallow: /api/");
});

test("home exposes the current SourceBoard brand assets in metadata and as public images", async ({
  request,
}) => {
  const [pageResponse, markResponse, lockupResponse, bannerResponse] = await Promise.all([
    request.get("/"),
    request.get("/sourceboard-brand-mark.png"),
    request.get("/sourceboard-brand-lockup.png"),
    request.get("/sourceboard-brand-banner.jpg"),
  ]);

  expect(pageResponse.status()).toBe(200);
  const html = await pageResponse.text();
  expect(html).toContain(
    'property="og:image" content="https://srcboard.me/sourceboard-brand-banner.jpg"',
  );
  expect(html).toContain("sourceboard-brand-mark.png");
  expect(html).toContain("sourceboard-brand-lockup.png");
  expect(html).toContain('rel="icon"');
  expect(markResponse.status()).toBe(200);
  expect(markResponse.headers()["content-type"]).toContain("image/png");
  expect(lockupResponse.status()).toBe(200);
  expect(lockupResponse.headers()["content-type"]).toContain("image/png");
  expect(bannerResponse.status()).toBe(200);
  expect(bannerResponse.headers()["content-type"]).toContain("image/jpeg");
});

test("post API does not allow unauthenticated mutations", async ({ request }) => {
  const response = await request.post("/api/posts", {
    headers: {
      origin: "http://localhost:5173",
      "x-csrf-token": "missing",
    },
  });

  expect([401, 503]).toContain(response.status());
  if (response.headers()["content-type"]?.includes("application/json")) {
    await expect(response.json()).resolves.toMatchObject({ error: { code: expect.any(String) } });
  }
});
