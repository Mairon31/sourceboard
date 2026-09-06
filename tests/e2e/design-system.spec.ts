import { expect, test } from "@playwright/test";

const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("sourceboard-theme"));
});

test("renders the Phase 0A visual laboratory", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SourceBoard", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Phase 0A visual laboratory" })).toBeVisible();
  await expect(
    page.getByText("Presentation only — product persistence arrives in later phases."),
  ).toBeVisible();
});

test("theme follows the system and supports override", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "system");

  await page.getByRole("button", { name: "Light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "light");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("sourceboard-theme")))
    .toBe("light");

  await page.getByRole("button", { name: "System theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("interactive primitives support keyboard use", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Open source preview" }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Source preview" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Open mobile drawer" }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Drawer preview" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "More demo actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Copy sample link" })).toBeVisible();
  await page.keyboard.press("Escape");

  const tooltipTrigger = page.getByRole("button", { name: "Why Liquid Glass?" });
  await tooltipTrigger.focus();
  await expect(page.getByText("Glass is reserved for elevated chrome and overlays.")).toBeVisible();

  const surfaceTab = page.getByRole("tab", { name: "Surface" });
  await surfaceTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Controls" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("reduced motion collapses decorative animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("tab", { name: "States" }).click();

  const shimmer = await page.getByTestId("demo-skeleton").evaluate((element) => {
    const pseudo = getComputedStyle(element, "::after");
    return { display: pseudo.display, duration: pseudo.animationDuration };
  });
  expect(shimmer.display).toBe("none");
});

for (const viewport of viewports) {
  test(`layout has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("banner")).toBeVisible();

    const diagnostic = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className: element.className,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .filter((entry) => entry.left < -1 || entry.right > window.innerWidth + 1)
        .slice(0, 12);
      return { overflow, offenders };
    });

    if (diagnostic.overflow > 1) {
      console.log(`Overflow diagnostics at ${viewport.width}px:`, diagnostic.offenders);
    }
    expect(diagnostic.overflow).toBeLessThanOrEqual(1);
  });
}
