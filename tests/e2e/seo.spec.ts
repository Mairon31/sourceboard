import { expect, test } from "@playwright/test";

test("robots exposes only the public sitemap entry point", async ({ request }) => {
  const response = await request.get("/robots.txt");

  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("Disallow: /api/");
  expect(body).toContain("Sitemap: http://localhost:5173/sitemap.xml");
});

test("home exposes the SourceBoard brand asset in the document and as a public image", async ({
  request,
}) => {
  const [pageResponse, logoResponse, ogResponse] = await Promise.all([
    request.get("/"),
    request.get("/sourceboard-logo.svg"),
    request.get("/sourceboard-og.png"),
  ]);

  expect(pageResponse.status()).toBe(200);
  const html = await pageResponse.text();
  expect(html).toContain('property="og:image" content="https://srcboard.me/sourceboard-og.png"');
  expect(html).toContain('rel="icon"');
  expect(logoResponse.status()).toBe(200);
  expect(logoResponse.headers()["content-type"]).toContain("image/svg+xml");
  expect(ogResponse.status()).toBe(200);
  expect(ogResponse.headers()["content-type"]).toContain("image/png");
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
