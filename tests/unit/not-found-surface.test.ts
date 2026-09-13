import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");
const componentPath = resolve(import.meta.dirname, "../../app/components/product/NotFoundPage.tsx");
const cssPath = resolve(import.meta.dirname, "../../app/components/product/not-found.css");
const routePath = resolve(import.meta.dirname, "../../app/routes/not-found.tsx");

describe("unified not-found surface", () => {
  it("defines one privacy-safe localized 404 component with Home and optional Back actions", () => {
    expect(existsSync(componentPath)).toBe(true);
    if (!existsSync(componentPath)) return;

    const source = read("../../app/components/product/NotFoundPage.tsx");
    expect(source).toContain("export function NotFoundPage");
    expect(source).toContain("homeHref?: string");
    expect(source).toContain("showBack?: boolean");
    expect(source).toContain("product-not-found__illustration");
    expect(source).toContain('t("errors.notFound.home")');
    expect(source).toContain('t("errors.notFound.back")');
    for (const leakedState of ["blocked", "private", "deleted"]) {
      expect(source.toLowerCase()).not.toContain(leakedState);
    }
  });

  it("bounds illustration motion and disables it for reduced-motion users", () => {
    expect(existsSync(cssPath)).toBe(true);
    if (!existsSync(cssPath)) return;

    const css = read("../../app/components/product/not-found.css");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".product-not-found__illustration *");
    expect(css).toContain("animation: none !important");
  });

  it("uses the same surface for post, profile and share 404 paths", () => {
    for (const path of [
      "../../app/routes/post-detail.tsx",
      "../../app/routes/profile.tsx",
      "../../app/routes/share-resolver.tsx",
    ]) {
      const source = read(path);
      expect(source).toContain('from "../components/product/NotFoundPage"');
      expect(source).toContain("<NotFoundPage");
    }
  });

  it("registers a real 404 catch-all after every concrete route", () => {
    expect(existsSync(routePath)).toBe(true);
    if (!existsSync(routePath)) return;

    const routes = read("../../app/routes.ts");
    const catchAll = routes.indexOf('route("*", "routes/not-found.tsx")');
    expect(catchAll).toBeGreaterThan(-1);
    expect(routes.indexOf("route(", catchAll + 1)).toBe(-1);

    const route = read("../../app/routes/not-found.tsx");
    expect(route).toContain("status: 404");
    expect(route).toContain("<NotFoundPage");
    expect(route).toContain('content: "noindex, nofollow"');
  });
});
