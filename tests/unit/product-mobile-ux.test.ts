import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const productCss = readFileSync(
  new URL("../../app/components/product/product.css", import.meta.url),
  "utf8",
);
const productNavSource = readFileSync(
  new URL("../../app/components/product/ProductNav.tsx", import.meta.url),
  "utf8",
);
const profileRouteSource = readFileSync(
  new URL("../../app/routes/profile.tsx", import.meta.url),
  "utf8",
);
const profileEditorUrl = new URL(
  "../../app/components/product/ProfileEditor.tsx",
  import.meta.url,
);
const profileEditorSource = existsSync(profileEditorUrl)
  ? readFileSync(profileEditorUrl, "utf8")
  : "";

function readCssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return productCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("mobile product UX regressions", () => {
  it("lets real post media size itself from the image aspect ratio without letterboxing", () => {
    const mediaRule = readCssRule(".product-post__media");
    const imageRule = readCssRule(".product-post__media img");

    expect(mediaRule).not.toContain("min-height");
    expect(imageRule).toContain("height: auto");
    expect(imageRule).not.toContain("max-height");
  });

  it("uses Profile instead of duplicate Alerts in the mobile bottom navigation", () => {
    const mobileNavSource = productNavSource.slice(
      productNavSource.indexOf("export function MobileProductNav"),
      productNavSource.indexOf("export function ProductContextRail"),
    );

    expect(mobileNavSource).toContain("profileHref");
    expect(mobileNavSource).toContain("Profile");
    expect(mobileNavSource).not.toContain("Alerts");
  });

  it("exposes an owner-only profile editor wired to the existing profile and media APIs", () => {
    expect(profileRouteSource).toContain("ProfileEditor");
    expect(profileRouteSource).toContain("isOwnProfile");
    expect(profileEditorSource).toContain('/api/profile/me');
    expect(profileEditorSource).toContain('/api/profile/media');
    expect(profileEditorSource).toContain('method: "PATCH"');
  });
});
