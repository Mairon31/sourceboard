import { expect, test } from "@playwright/test";
import { waitForUiReady } from "./test-helpers";

test("admin dashboard uses the moderation-focused shell", async ({ page }) => {
  await page.goto("/admin");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Administration navigation" }).getByRole("link", {
      name: "Moderation",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Audit" })).toBeVisible();
  await expect(page.getByText("Open reports")).toBeVisible();
});

test("moderation queue presents NSFW and source-review context", async ({ page }) => {
  await page.goto("/admin/moderation");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Moderation queue" })).toBeVisible();
  await expect(page.getByText("Potentially sensitive media not marked by author")).toBeVisible();
  await expect(page.getByText("Misleading-source report requires review")).toBeVisible();
  await expect(page.getByText("NSFW").first()).toBeVisible();
});

test("anonymous identity reveal is reason-gated", async ({ page }) => {
  await page.goto("/admin/anonymous/post-anonymous");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Anonymous author" })).toBeVisible();
  const reveal = page.getByRole("button", { name: "Reveal identity" });
  await expect(reveal).toBeDisabled();

  await page.getByLabel("Reason for access").fill("Investigating coordinated abuse report");
  await expect(reveal).toBeEnabled();
  await reveal.click();
  await expect(page.getByText("Presentation-only identity preview")).toBeVisible();
  await expect(page.getByText("Access would be audited in the production system.")).toBeVisible();
});
