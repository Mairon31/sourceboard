import { expect, test } from "@playwright/test";

test("auth surfaces expose their intended forms", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();

  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();

  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();

  await page.goto("/verify-email");
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
});

test("feed presents discovery tabs and privacy-sensitive states", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Find the original source" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Recent" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Friends" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Answered" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Verified" })).toBeVisible();
  await expect(page.getByText("Anonymous Author").first()).toBeVisible();
  await expect(page.getByText("Content hidden by your NSFW preference")).toBeVisible();
});

test("create-post surface exposes anonymous and NSFW controls", async ({ page }) => {
  await page.goto("/post/new");

  await expect(page.getByRole("heading", { name: "Create a source request" })).toBeVisible();
  await expect(page.getByLabel("Title")).toBeVisible();
  await expect(page.getByLabel("Description")).toBeVisible();
  await expect(page.getByLabel("Visibility")).toBeVisible();
  await expect(page.getByLabel("Post anonymously")).toBeVisible();
  await expect(page.getByLabel("Mark as NSFW")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish request" })).toBeVisible();
});

test("post detail presents comments and source resolution", async ({ page }) => {
  await page.goto("/posts/post-verified");

  await expect(
    page.getByRole("heading", { name: "Original editorial photo found and verified" }),
  ).toBeVisible();
  await expect(page.getByText("Accepted Source").first()).toBeVisible();
  await expect(page.getByText("Verified Source").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comments" })).toBeVisible();
  await expect(page.getByText("Reaction GIF preview")).toBeVisible();
  await expect(page.getByText("Hidden by moderation")).toBeVisible();
});
