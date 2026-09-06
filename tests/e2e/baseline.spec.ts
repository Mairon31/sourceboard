import { expect, test } from "@playwright/test";

test("home is server-rendered and reachable", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Find the original source" })).toBeVisible();
  await expect(page).toHaveTitle("SourceBoard");
});

test("health endpoint returns JSON and propagates request id", async ({ request }) => {
  const response = await request.get("/api/health", {
    headers: { "x-request-id": "e2e-health" },
  });

  expect(response.ok()).toBe(true);
  expect(response.headers()["x-request-id"]).toBe("e2e-health");
  await expect(response.json()).resolves.toEqual({
    status: "ok",
    service: "sourceboard",
    requestId: "e2e-health",
    bindings: {
      db: true,
      media: true,
      cache: true,
      events: true,
      rateLimits: {
        auth: true,
        content: true,
        reactions: true,
        uploads: true,
      },
      email: true,
      turnstile: false,
    },
  });
});
