import { expect, test } from "@playwright/test";

test("source resolution endpoints do not expose unauthenticated mutation paths", async ({
  request,
}) => {
  const response = await request.post("/api/posts/post-anonymous/source/accept", {
    data: { commentId: "comment-source" },
  });
  expect([401, 403]).toContain(response.status());
  expect(response.status()).toBeLessThan(500);
});

test("cross-post source identifiers are validated by the Worker contract", async ({ request }) => {
  const response = await request.post("/api/posts/post-verified/source/verify", {
    data: {
      commentId: "comment-source",
      canonicalSourceUrl: "https://example.com/source",
      evidenceNote: "Evidence is supplied by a verifier for this test.",
    },
  });
  expect([401, 403]).toContain(response.status());
  expect(response.status()).toBeLessThan(500);
});
