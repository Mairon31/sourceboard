import { expect, test } from "@playwright/test";

const ADMIN_PATHS = [
  "/admin",
  "/admin/moderation",
  "/admin/source-integrity",
  "/admin/verifications",
  "/admin/users",
  "/admin/roles",
  "/admin/reputation",
  "/admin/store",
  "/admin/content",
  "/admin/audit",
  "/admin/anonymous/test-post",
] as const;

test.describe("admin zero-flash authorization", () => {
  for (const path of ADMIN_PATHS) {
    test(`signed-out ${path} redirects before privileged HTML renders`, async ({ request, page }) => {
      const raw = await request.get(path, { maxRedirects: 0 });
      expect(raw.status(), path).toBe(302);
      expect(raw.headers().location, path).toContain("/login?next=");
      const rawBody = await raw.text();
      expect(rawBody, path).not.toContain("admin-shell");
      expect(rawBody, path).not.toContain("Moderation queue");
      expect(rawBody, path).not.toContain("Audit log");

      await page.goto(path);
      await expect(page.locator(".admin-shell"), path).toHaveCount(0);
      await expect(page.locator("body"), path).not.toContainText("Admin access required");
    });
  }
});
