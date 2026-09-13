import { expect, test } from "@playwright/test";

test.describe("platform overhaul privacy/security matrix", () => {
  test("signed-out admin HTML contains no privileged shell", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator(".admin-shell")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Store management");
  });

  test("invalid short links disclose no target metadata", async ({ request }) => {
    const response = await request.get("/sh/platform-overhaul-invalid-short-id", {
      maxRedirects: 0,
    });
    expect([302, 404]).toContain(response.status());
    const body = await response.text();
    expect(body).not.toContain("email_lookup_hash");
    expect(body).not.toContain("email_encrypted");
  });

  test("robots excludes account, admin and internal resource surfaces", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    for (const path of ["/admin/", "/settings", "/notifications", "/friends", "/resources/"]) {
      expect(body).toContain(`Disallow: ${path}`);
    }
  });
});
