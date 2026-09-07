import { expect, test } from "@playwright/test";

const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

const routes = [
  "/",
  "/search?q=source",
  "/posts/post-verified",
  "/u/aurora",
  "/store",
  "/admin/moderation",
];

for (const viewport of viewports) {
  for (const path of routes) {
    test(`${path} has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 1 && path === "/store") {
        const offenders = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("*")]
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                tag: element.tagName,
                className: String(element.className).slice(0, 160),
                text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 100),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
              };
            })
            .filter((item) => item.right > window.innerWidth + 1 || item.left < -1)
            .sort((left, right) => right.right - left.right)
            .slice(0, 20),
        );
        console.log("STORE_OVERFLOW_DIAGNOSTIC", JSON.stringify({ viewport, overflow, offenders }));
      }
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
}

test("reduced motion remains active on product surfaces", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator("html")).toBeVisible();
  const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  expect(reduced).toBe(true);
});
