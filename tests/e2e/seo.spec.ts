import { expect, test } from "@playwright/test";

test("robots exposes only the public sitemap entry point", async ({ request }) => {
  const response = await request.get("/robots.txt");

  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("Disallow: /api/");
  expect(body).toContain("Sitemap: http://127.0.0.1:5173/sitemap.xml");
});

test("post API does not allow unauthenticated mutations", async ({ request }) => {
  const response = await request.post("/api/posts", {
    headers: {
      origin: "http://127.0.0.1:5173",
      "x-csrf-token": "missing",
    },
  });

  expect([401, 503]).toContain(response.status());
  if (response.headers()["content-type"]?.includes("application/json")) {
    await expect(response.json()).resolves.toMatchObject({ error: { code: expect.any(String) } });
  }
});
