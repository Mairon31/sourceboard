import { expect, test } from "@playwright/test";
import { installAdminStoreFixture, waitForUiReady } from "./test-helpers";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=",
  "base64",
);

test("post creation requires and submits a searchable canonical category", async ({ page }) => {
  let submittedBody = "";
  await page.route("**/api/posts", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }
    submittedBody = (await request.postDataBuffer())?.toString("utf8") ?? "";
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ post: { id: "e2e-category-post", slug: "e2e-category-post" } }),
    });
  });

  await installAdminStoreFixture(page);
  await page.goto("/post/new");
  await waitForUiReady(page);

  const publish = page.getByRole("button", { name: "Publish request" });
  await expect(publish).toBeDisabled();

  await page.getByLabel("Title").fill("Find the original manga panel");
  await page.getByLabel("Main image", { exact: true }).setInputFiles({
    name: "source.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await expect(publish).toBeDisabled();

  const category = page.getByRole("combobox", { name: "Category" });
  await category.fill("manga");
  const option = page.getByRole("option", { name: /Manga & Manhwa/ });
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.getByText("Manga & Manhwa", { exact: true })).toBeVisible();
  await expect(publish).toBeEnabled();

  await publish.click();
  await expect(page).toHaveURL(/\/posts\/e2e-category-post\/e2e-category-post$/);
  expect(submittedBody).toContain('name="category"');
  expect(submittedBody).toContain("manga-manhwa");
});
