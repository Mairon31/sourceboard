import { expect, test } from "@playwright/test";

test("source resolution endpoints do not expose unauthenticated mutation paths", async ({
  page,
}) => {
  await page.goto("/posts/post-anonymous");
  const status = await page.evaluate(async () => {
    const response = await fetch("/api/posts/post-anonymous/source/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commentId: "comment-source" }),
    });
    return response.status;
  });
  expect([401, 403]).toContain(status);
  expect(status).toBeLessThan(500);
});

test("cross-post source identifiers are validated by the Worker contract", async ({ page }) => {
  await page.goto("/posts/post-verified");
  const status = await page.evaluate(async () => {
    const response = await fetch("/api/posts/post-verified/source/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        commentId: "comment-source",
        canonicalSourceUrl: "https://example.com/source",
        evidenceNote: "Evidence is supplied by a verifier for this test.",
      }),
    });
    return response.status;
  });
  expect([401, 403]).toContain(status);
  expect(status).toBeLessThan(500);
});
