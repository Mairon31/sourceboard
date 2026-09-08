import { expect, test } from "@playwright/test";

test("auth surfaces expose their intended forms", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();

  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();

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
  await expect(page.getByRole("tabpanel", { name: "Recent" })).toBeVisible();
});

test("home presents the connected production service", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Presentation build" })).toHaveCount(0);
  await expect(
    page.getByText("Source requests are connected to the community service."),
  ).toBeVisible();
});

test("signed-out home does not render a fixture account", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Aurora Vale")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("search surface accepts a public discovery query", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("search").getByLabel("Search SourceBoard").fill("source");
  await page.getByRole("search").getByLabel("Search SourceBoard").press("Enter");

  await expect(page).toHaveURL(/\/search\?q=source/);
  await expect(page.getByRole("heading", { name: /Search results for/ })).toBeVisible();
  await expect(page.getByText(/No public matches|Search unavailable/)).toBeVisible();
});

test("SSR inline scripts use the response CSP nonce", async ({ page }) => {
  const response = await page.goto("/");
  const policy = response?.headers()["content-security-policy"] ?? "";
  const nonce = await page
    .locator("script")
    .evaluateAll((scripts) =>
      scripts.map((script) => (script as HTMLScriptElement).nonce).find(Boolean),
    );

  expect(nonce).toBeTruthy();
  expect(policy).toContain(`'nonce-${nonce}'`);
  expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
});

test("create-post surface exposes anonymous and NSFW controls", async ({ page }) => {
  await page.goto("/post/new");

  await expect(page.getByRole("heading", { name: "Create a source request" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sign in to publish a source request" }),
  ).toBeVisible();
  await expect(page.getByRole("region").getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("post detail protects missing persisted data", async ({ page }) => {
  const response = await page.goto("/posts/post-verified");

  expect(response?.status()).toBeLessThan(500);
  await expect(
    page.getByRole("heading", { name: /Post (not found|service unavailable)/ }),
  ).toBeVisible();
  await expect(page.getByText("No private post data was returned to the browser.")).toBeVisible();
});
