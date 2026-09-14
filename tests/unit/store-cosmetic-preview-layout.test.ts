import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");

describe("Store cosmetic preview composition", () => {
  it("renders a focused identity subject inside cosmetic-only previews", () => {
    const preview = read("../../app/components/product/ProfileCosmeticPreview.tsx");

    expect(preview).toContain("AvatarStage");
    expect(preview.match(/<AvatarStage/g) ?? []).toHaveLength(1);
    expect(preview).toContain("<CosmeticIdentity");
    expect(preview).not.toContain('className="profile-header product-cosmetic-preview__header"');
  });

  it("keeps theme and profile-effect previews visually unobstructed", () => {
    const cssPath = resolve(
      import.meta.dirname,
      "../../app/components/product/profile-cosmetic-preview.css",
    );
    expect(existsSync(cssPath)).toBe(true);
    if (!existsSync(cssPath)) return;

    const css = read("../../app/components/product/profile-cosmetic-preview.css");
    expect(css).toMatch(
      /\.product-cosmetic-preview--card\s+\.product-profile-card-surface\s*\{[^}]*background:\s*transparent(?:\s*!important)?;/s,
    );
    expect(css).toContain("background: transparent !important");
    expect(css).toContain("product-cosmetic-preview--card .product-profile-effect-layer");
    expect(css).toMatch(/\.product-cosmetic-preview__subject\s*\{[^}]*place-items:\s*center;/s);
  });

  it("centers avatar-frame previews without a display-name row", () => {
    const preview = read("../../app/components/product/ProfileCosmeticPreview.tsx");
    expect(preview).toContain('className="product-cosmetic-preview__frame-surface"');
    expect(preview).toContain('size="preview"');
    expect(preview).toContain("frame={frame}");
  });

  it("keeps preset classes available for static store fallbacks", () => {
    const preview = read("../../app/components/product/ProfileCosmeticPreview.tsx");
    expect(preview).toContain("product-cosmetic-preview--${preset}");
    expect(preview).toContain("product-store-preview--effect");
  });
});
