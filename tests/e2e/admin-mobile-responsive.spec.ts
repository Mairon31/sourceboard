import { expect, test } from "@playwright/test";
import { installAdminStoreFixture, waitForUiReady } from "./test-helpers";

test.describe("admin mobile workspace", () => {
  test("keeps the complete administration navigation inside a mobile menu", async ({ page }) => {
    await installAdminStoreFixture(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin");
    await waitForUiReady(page);

    const menu = page.getByRole("button", { name: "Open administration navigation" });
    await expect(menu).toBeVisible();
    await expect(page.locator(".admin-mobile-current")).toHaveText("Overview");
    const reviewQueue = page.locator(".admin-page-header__actions > a");
    await expect(reviewQueue).toBeVisible();
    await expect(reviewQueue).toHaveJSProperty("tagName", "A");
    expect(
      await reviewQueue.evaluate((element) => element.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    await expect(page.locator("#admin-navigation")).toBeHidden();

    await menu.click();
    await expect(page.locator("#admin-navigation")).toBeVisible();
    await expect(page.locator(".admin-sidebar__footer")).toBeVisible();
    expect(
      await page
        .locator(".admin-sidebar__footer > a")
        .evaluate((element) => element.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    await expect(page.locator("#admin-navigation").getByRole("link")).toHaveCount(9);

    const geometry = await page.locator("#admin-navigation").evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const links = [...element.querySelectorAll("a")].map((link) => {
        const rect = link.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        bounds: { left: bounds.left, right: bounds.right },
        links,
        documentOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
    for (const link of geometry.links) {
      expect(link.left).toBeGreaterThanOrEqual(geometry.bounds.left - 1);
      expect(link.right).toBeLessThanOrEqual(geometry.bounds.right + 1);
    }
  });

  test("gives source integrity views readable touch targets on mobile", async ({ page }) => {
    await installAdminStoreFixture(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/source-integrity?view=review");
    await waitForUiReady(page);

    const tabs = page.locator(".admin-integrity-tabs");
    await expect(tabs).toBeVisible();
    const layout = await tabs.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const links = [...element.querySelectorAll("a")].map((link) => {
        const linkRect = link.getBoundingClientRect();
        return { height: linkRect.height, left: linkRect.left, right: linkRect.right };
      });
      return {
        display: style.display,
        gap: parseFloat(style.gap) || 0,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        left: rect.left,
        right: rect.right,
        links,
      };
    });

    expect(["flex", "grid"]).toContain(layout.display);
    expect(layout.gap).toBeGreaterThanOrEqual(8);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.links).toHaveLength(4);
    for (const link of layout.links) {
      expect(link.height).toBeGreaterThanOrEqual(44);
      expect(link.left).toBeGreaterThanOrEqual(layout.left - 1);
      expect(link.right).toBeLessThanOrEqual(layout.right + 1);
    }
  });

  test("stacks the Users enforcement policy instead of joining its copy", async ({ page }) => {
    await installAdminStoreFixture(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/users");
    await waitForUiReady(page);

    const policy = page.locator(".admin-user-policy-strip");
    await expect(policy).toBeVisible();
    const layout = await policy.evaluate((element) => {
      const style = getComputedStyle(element);
      const title = element.querySelector("strong")?.getBoundingClientRect();
      const description = element.querySelector("span")?.getBoundingClientRect();
      return {
        display: style.display,
        gap: parseFloat(style.gap) || 0,
        titleBottom: title?.bottom ?? 0,
        descriptionTop: description?.top ?? 0,
      };
    });

    expect(["flex", "grid"]).toContain(layout.display);
    expect(layout.gap).toBeGreaterThanOrEqual(8);
    expect(layout.descriptionTop).toBeGreaterThanOrEqual(layout.titleBottom);
  });

  test("renders the CMS preview with the canonical safe renderer", async ({ page }) => {
    await installAdminStoreFixture(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const suffix = Date.now().toString(36);
    await page.goto("/admin/content");
    await waitForUiReady(page);

    await page.getByLabel("Slug", { exact: true }).fill(`mobile-preview-${suffix}`);
    await page.getByLabel("Title", { exact: true }).fill(`Mobile preview ${suffix}`);
    await page.getByLabel("Description", { exact: true }).fill("Responsive content preview");
    await page
      .getByRole("textbox", { name: "Markdown body", exact: true })
      .fill("## Safe heading\n\nPreview body.");
    await page.getByRole("button", { name: "Create a draft", exact: true }).click();

    const pageCard = page.locator(".admin-store-cosmetic-card").filter({
      hasText: `Mobile preview ${suffix}`,
    });
    await expect(pageCard).toBeVisible();
    await pageCard.getByRole("link", { name: "Open editor", exact: true }).click();
    await waitForUiReady(page);

    const preview = page.locator(".admin-content-editor__preview");
    await expect(preview.locator(":scope > h2")).toHaveText(`Mobile preview ${suffix}`);
    await expect(preview.locator(".product-cms-markdown")).toBeVisible();
    await expect(preview.locator("pre")).toHaveCount(0);

    const geometry = await preview.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      scrollWidth: element.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
    expect(geometry.width).toBeLessThanOrEqual(geometry.viewportWidth);
  });

  test("keeps every admin surface contained at phone and tablet widths", async ({ page }) => {
    await installAdminStoreFixture(page);
    const routes = [
      "/admin",
      "/admin/moderation",
      "/admin/source-integrity?view=review",
      "/admin/users",
      "/admin/roles",
      "/admin/reputation",
      "/admin/store",
      "/admin/content",
      "/admin/audit",
    ];

    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(route);
        await waitForUiReady(page);
        const overflow = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          shell: document.querySelector<HTMLElement>(".admin-shell")?.scrollWidth ?? 0,
          viewport: document.documentElement.clientWidth,
        }));
        expect(overflow.document).toBeLessThanOrEqual(1);
        expect(overflow.shell).toBeLessThanOrEqual(overflow.viewport + 1);
      }
    }
  });
});
