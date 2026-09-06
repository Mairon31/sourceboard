import { expect, test } from "@playwright/test";

test("profile mutations require authentication even when the request is same-origin", async ({
  request,
}) => {
  const response = await request.patch("/api/profile/me", {
    headers: {
      origin: "http://127.0.0.1:5173",
      "content-type": "application/json",
    },
    data: {
      displayName: "Should not write",
      bio: "",
      profileVisibility: "PUBLIC",
      socialLinks: [],
    },
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: "AUTHENTICATION_REQUIRED" },
  });
});

test("profile mutations reject foreign origins before any write", async ({ request }) => {
  const response = await request.patch("/api/profile/me", {
    headers: {
      origin: "https://evil.example",
      "content-type": "application/json",
    },
    data: {
      displayName: "Should not write",
      bio: "",
      profileVisibility: "PUBLIC",
      socialLinks: [],
    },
  });

  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: "CSRF_ORIGIN_INVALID" },
  });
});
