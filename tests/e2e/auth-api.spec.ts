import { expect, test } from "@playwright/test";

test("auth session endpoint does not invent an anonymous identity", async ({ request }) => {
  const response = await request.get("/api/auth/session");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({ authenticated: false, user: null });
});

test("auth mutations reject a foreign origin before processing credentials", async ({
  request,
}) => {
  const response = await request.post("/api/auth/login", {
    headers: {
      origin: "https://evil.example",
      "content-type": "application/json",
    },
    data: { email: "alice@example.com", password: "correct horse battery staple" },
  });

  expect(response.status()).toBe(403);
  const body = await response.json();
  expect(body.error.code).toBe("CSRF_ORIGIN_INVALID");
  expect(body.error.message).toContain("same-origin");
});
