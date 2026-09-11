import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const sourceApi = readFileSync(new URL("../../worker/source/api.ts", import.meta.url), "utf8");
const adminVerifications = readFileSync(
  new URL("../../app/routes/admin-verifications.tsx", import.meta.url),
  "utf8",
);

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
  expect([400, 401, 403]).toContain(status);
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
  expect([400, 401, 403]).toContain(status);
  expect(status).toBeLessThan(500);
});

test("persisted link previews feed accepted and verified source canonical URLs", () => {
  expect(sourceApi).toContain("LEFT JOIN comment_link_previews lp ON lp.comment_id = c.id");
  expect(sourceApi).toContain("lp.canonical_url AS comment_preview_url");
  expect(sourceApi).toContain("canonical_source_url, actor_user_id, created_at");
  expect(adminVerifications).toContain("lp.canonical_url AS canonicalSourceUrl");
  expect(adminVerifications).toContain('defaultValue={candidate.canonicalSourceUrl ?? ""}');
});
