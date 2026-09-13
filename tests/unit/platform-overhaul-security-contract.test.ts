import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCosmeticVisualConfig } from "../../shared/store/cosmetic-config";

const read = (path: string) => readFileSync(path, "utf8");

describe("platform overhaul security contract", () => {
  it("server-gates every admin page through the shared authorization boundary", () => {
    const access = read("app/data/admin-access.ts");
    expect(access).toContain("requireAdminPageAccess");
    for (const route of [
      "app/routes/admin.tsx",
      "app/routes/admin-store.tsx",
      "app/routes/admin-content.tsx",
      "app/routes/admin-content-page.tsx",
    ]) {
      expect(read(route), route).toContain("requireAdminPageAccess");
    }
  });

  it("keeps share aliases out of sitemap identity and marks them noindex", () => {
    const share = read("app/routes/share-resolver.tsx");
    const seo = read("worker/seo/public.ts");
    expect(share).toContain("noindex");
    expect(seo).not.toContain('loc: absoluteSourceBoardUrl("/sh/');
  });

  it("allowlists Google Fonts origins and rejects arbitrary font providers", () => {
    const headers = read("worker/security/headers.ts");
    const fonts = read("shared/store/font-providers.ts");
    expect(headers).toContain("https://fonts.googleapis.com");
    expect(headers).toContain("https://fonts.gstatic.com");
    expect(fonts).toContain("GOOGLE_FONT_REGISTRY");
    expect(fonts).not.toContain("fonts.bunny.net");
  });

  it("uses strict structured Creator Pro validation", () => {
    const valid = {
      schemaVersion: 1,
      palette: ["#ffffff"],
      animation: {
        durationMs: 60_000,
        delayMs: 0,
        easing: "linear",
        direction: "normal",
        iterations: 1,
      },
      particles: { count: 48, size: 1, speed: 1, spread: 1, path: "drift" },
    };
    expect(parseCosmeticVisualConfig(valid).animation?.durationMs).toBe(60_000);
    expect(() => parseCosmeticVisualConfig({ ...valid, unsupported: true })).toThrow();
    expect(() =>
      parseCosmeticVisualConfig({
        ...valid,
        animation: { ...valid.animation, durationMs: 60_001 },
      }),
    ).toThrow();
    expect(() =>
      parseCosmeticVisualConfig({
        ...valid,
        particles: { ...valid.particles, count: 49 },
      }),
    ).toThrow();
  });
});
