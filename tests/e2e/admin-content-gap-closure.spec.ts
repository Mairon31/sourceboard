import { expect, test } from "@playwright/test";
import { installAdminStoreFixture, waitForUiReady } from "./test-helpers";

test("Content admin creates, versions, publishes, translates and archives a page", async ({
  page,
}) => {
  await installAdminStoreFixture(page);
  const suffix = Date.now().toString(36);
  const slug = `e2e-cms-${suffix}`;
  const title = `E2E CMS ${suffix}`;

  await page.goto("/admin/content");
  await waitForUiReady(page);
  await expect(page.getByRole("heading", { name: "Docs, Legal & Pages" })).toBeVisible();

  await page.getByLabel("Slug", { exact: true }).fill(slug);
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Description", { exact: true }).fill("CMS browser verification");
  await page.getByRole("textbox", { name: "Markdown body", exact: true }).fill("# English draft");
  await page.getByRole("button", { name: "Create a draft", exact: true }).click();

  await expect(page.getByRole("status")).toContainText("Draft created.");
  const pageCard = page.locator(".admin-store-cosmetic-card").filter({ hasText: title });
  await expect(pageCard).toBeVisible();
  await pageCard.getByRole("link", { name: "Open editor", exact: true }).click();
  await waitForUiReady(page);

  const englishTab = page.getByRole("tab").filter({ hasText: "EN" }).first();
  await expect(englishTab).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill(`${title} v2`);
  await page
    .getByRole("textbox", { name: "Markdown body", exact: true })
    .fill("# English revision two");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft v2 saved.");
  await page.getByRole("button", { name: "Publish latest draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Published revision updated.");
  await expect(englishTab).toContainText("Published");

  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Locale unpublished.");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Locale archived.");

  const spanishTab = page.getByRole("tab").filter({ hasText: "ES" }).first();
  await spanishTab.click();
  await page.getByLabel("Slug", { exact: true }).fill(`${slug}-es`);
  await page.getByLabel("Title", { exact: true }).fill(`${title} ES`);
  await page.getByLabel("Description", { exact: true }).fill("Verificación CMS");
  await page
    .getByRole("textbox", { name: "Markdown body", exact: true })
    .fill("# Borrador español");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft v1 saved.");
  await page.getByRole("button", { name: "Publish latest draft", exact: true }).click();
  await expect(spanishTab).toContainText("Published");
});

