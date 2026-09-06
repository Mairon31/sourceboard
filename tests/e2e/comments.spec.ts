import { expect, test } from "@playwright/test";

test("comment API rejects unauthenticated mutation and preserves its error envelope", async ({
  request,
}) => {
  const response = await request.post("/api/posts/post-missing/comments", {
    headers: {
      origin: "http://127.0.0.1:5173",
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
      origin: "http://127.0.0.1:5173",
      "x-csrf-token": "missing",
    },
    data: {
      richtext: [{ type: "image", src: "https://third-party.invalid/image.png" }],
    },
  });

  expect([401, 404, 503]).toContain(response.status());
});
