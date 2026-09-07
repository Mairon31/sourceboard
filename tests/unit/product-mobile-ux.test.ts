import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readOptionalSource(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const postCardSource = readFileSync(
  new URL("../../app/components/product/PostCard.tsx", import.meta.url),
  "utf8",
);
const postMediaCss = readOptionalSource("../../app/components/product/post-media.css");
const productNavSource = readFileSync(
  new URL("../../app/components/product/ProductNav.tsx", import.meta.url),
  "utf8",
);
const rootSource = readFileSync(new URL("../../app/root.tsx", import.meta.url), "utf8");
const profileRouteSource = readFileSync(
  new URL("../../app/routes/profile.tsx", import.meta.url),
  "utf8",
);
const profileEditorSource = readOptionalSource("../../app/components/product/ProfileEditor.tsx");

describe("mobile product UX regressions", () => {
  it("lets real post media size itself from the image aspect ratio without letterboxing", () => {
    expect(postCardSource).toContain("product-post__media--image");
    expect(rootSource).toContain('import "./components/product/post-media.css"');
    expect(postMediaCss).toContain(".product-post__media--image");
    expect(postMediaCss).toContain("min-height: 0");
    expect(postMediaCss).toContain("height: auto");
    expect(postMediaCss).toContain("max-height: none");
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
    expect(profileEditorSource).toContain("/api/profile/me");
    expect(profileEditorSource).toContain("/api/profile/media");
    expect(profileEditorSource).toContain('method: "PATCH"');
  });
});
