import { expect, test } from "@playwright/test";
import { seedNavigationPostFixture, waitForUiReady } from "./test-helpers";

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

test.beforeAll(() => {
  seedNavigationPostFixture();
});

test("home exposes the SourceBoard product navigation", async ({ page }) => {
  await page.goto("/");
  await waitForUiReady(page);

  await expect(page.getByRole("link", { name: "SourceBoard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Friends" })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Store", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", {
      name: "Create post",
      exact: true,
    }),
  ).toBeVisible();
});

test("home feed tabs activate with arrow-key navigation", async ({ page }) => {
  await page.goto("/");
  await waitForUiReady(page);

  const recent = page.getByRole("tab", { name: "Recent" });
  const friends = page.getByRole("tab", { name: "Friends" });
  await recent.focus();
  await expect(recent).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(friends).toBeFocused();
  await expect(friends).toHaveAttribute("aria-selected", "true");
});

test("primary navigation exposes a visible keyboard focus ring", async ({ page }) => {
  await page.goto("/");
  await waitForUiReady(page);

  const home = page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Home", exact: true });
  await home.focus();
  await expect(home).toBeFocused();
  const focusStyle = await home.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth) };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);
});

test("deterministic post detail route responds directly", async ({ page }) => {
  const response = await page.goto("/posts/e2e-navigation-post/e2e-navigation-post");
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).not.toContainText("Application Error");
});

test("post title opens canonical detail", async ({ page }) => {
  await page.goto("/");
  await waitForUiReady(page);
  const card = page.locator(".product-post", { hasText: "E2E navigation post" });
  const title = card.locator(".product-post__title");
  await expect(title).toHaveAttribute("href", "/posts/e2e-navigation-post/e2e-navigation-post");
  await title.click();
  await expect(page).toHaveURL(/\/posts\/e2e-navigation-post\/e2e-navigation-post$/);
});

test("post author opens the public profile without triggering card navigation", async ({
  page,
}) => {
  await page.goto("/");
  await waitForUiReady(page);
  const card = page.locator(".product-post", { hasText: "E2E navigation post" });
  const author = card.locator('a[href="/u/e2e-navigation-user"]');
  await expect(author).toBeVisible();
  await author.click();
  await expect(page).toHaveURL(/\/u\/e2e-navigation-user$/);
  await expect(page).not.toHaveURL(/\/posts\/e2e-navigation-post/);
});

test("post card surface opens canonical detail", async ({ page }) => {
  await page.goto("/");
  await waitForUiReady(page);
  const card = page.locator(".product-post", { hasText: "E2E navigation post" });
  await card.locator(".product-post__media").click();
  await expect(page).toHaveURL(/\/posts\/e2e-navigation-post\/e2e-navigation-post$/);
});

test("Comment opens the comments target", async ({ page }) => {
  await page.goto("/");
  await waitForUiReady(page);
  const card = page.locator(".product-post", { hasText: "E2E navigation post" });
  const comment = card.getByRole("link", { name: "Comment" });
  await expect(comment).toHaveAttribute(
    "href",
    "/posts/e2e-navigation-post/e2e-navigation-post#comments",
  );
  await comment.click();
  await expect(page).toHaveURL(/\/posts\/e2e-navigation-post\/e2e-navigation-post#comments$/);
  await expect(page.locator("#comments")).toBeVisible();
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
