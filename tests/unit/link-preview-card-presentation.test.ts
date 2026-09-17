import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");

describe("LinkPreviewCard presentation contract", () => {
  it("keeps metadata status and compact variants on one accessible external card", () => {
    const component = read("../../app/components/product/LinkPreviewCard.tsx");
    const css = read("../../app/components/product/comment-actions.css");

    expect(component).toContain("data-metadata-status={preview.metadataStatus}");
    expect(component).toContain("product-link-preview-card--compact");
    expect(component).toContain('rel="noopener noreferrer"');
    expect(component).toContain('alt=""');
    expect(component).toContain("aria-label=");
    expect(css).toContain('.product-link-preview-card[data-metadata-status="MINIMAL"]');
    expect(css).toContain('.product-link-preview-card[data-metadata-status="URL_ONLY"]');
  });

  it("clamps descriptions and keeps preview content inside narrow layouts", () => {
    const css = read("../../app/components/product/comment-actions.css");

    expect(css).toMatch(
      /\.product-link-preview-card__description\s*\{[^}]*display:\s*-webkit-box;[^}]*-webkit-line-clamp:\s*3;/s,
    );
    expect(css).toContain("min-width: 0");
    expect(css).toContain("@media (max-width: 430px)");
    expect(css).toContain(".product-link-preview-card--compact");
  });

  it("shows the canonical URL only when no readable metadata was recovered", () => {
    const component = read("../../app/components/product/LinkPreviewCard.tsx");

    expect(component).toContain("const hasMetadata = Boolean(");
    expect(component).toContain("const showCanonicalUrl = !hasMetadata;");
    expect(component).toContain("{showCanonicalUrl ? (");
    expect(component).toContain("product-link-preview-card__url");
  });
});
