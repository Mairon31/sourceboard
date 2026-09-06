import { expect, test } from "@playwright/test";
import { waitForUiReady } from "./test-helpers";

const productRoutes = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
  "/search",
  "/post/new",
  "/posts/post-verified",
  "/u/aurora",
  "/friends",
  "/notifications",
  "/store",
  "/settings",
  "/admin",
  "/admin/moderation",
  "/admin/anonymous/post-anonymous",
];

test("home exposes the SourceBoard product navigation", async ({ page }) => {
  await page.goto("/");
  await waitForUiReady(page);

  await expect(page.getByRole("link", { name: "SourceBoard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Friends" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Store" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", {
      name: "Create post",
      exact: true,
    }),
  ).toBeVisible();
});

for (const path of productRoutes) {
  test(`SSR route ${path} renders without an application error`, async ({ page }) => {
    const response = await page.goto(path);

    if (path.startsWith("/posts/")) {
      expect([200, 404, 503]).toContain(response?.status());
    } else {
      expect(response?.status()).toBeLessThan(400);
    }
    await expect(page.locator("body")).not.toContainText("Application Error");
  });
}
