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
const productInteractionsCss = readOptionalSource(
  "../../app/components/product/product-interactions.css",
);
const productNavSource = readFileSync(
  new URL("../../app/components/product/ProductNav.tsx", import.meta.url),
  "utf8",
);
const iconSource = readFileSync(
  new URL("../../app/components/ui/icons.tsx", import.meta.url),
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

  it("opens post detail from real links while leaving nested controls interactive", () => {
    expect(postCardSource).toContain("useNavigate");
    expect(postCardSource).toContain("isInteractivePostTarget");
    expect(postCardSource).toContain("handleCardClick");
    expect(postCardSource).toContain("onClick={handleCardClick}");
    expect(postCardSource).toContain("className={mediaClass}");
    expect(postCardSource).toContain("to={detailHref}");
    expect(postCardSource).not.toContain('role="link"');
    expect(postCardSource).not.toContain("tabIndex={0}");
    expect(postCardSource).not.toContain("handleCardKeyDown");
  });

  it("uses Profile instead of duplicate Alerts in the mobile bottom navigation", () => {
    const mobileNavSource = productNavSource.slice(
      productNavSource.indexOf("export function MobileProductNav"),
      productNavSource.indexOf("export function ProductContextRail"),
    );

    expect(mobileNavSource).toContain("profileHref");
    expect(mobileNavSource).toContain('aria-label="Profile"');
    expect(mobileNavSource).not.toContain("Alerts");
  });

  it("renders compact icon-only mobile navigation with accessible labels", () => {
    const mobileNavSource = productNavSource.slice(
      productNavSource.indexOf("export function MobileProductNav"),
      productNavSource.indexOf("export function ProductContextRail"),
    );

    for (const icon of ["HomeIcon", "FriendsIcon", "PlusIcon", "UserIcon", "StoreIcon"]) {
      expect(iconSource).toContain(`export function ${icon}`);
      expect(mobileNavSource).toContain(`<${icon}`);
    }
    for (const label of ["Home", "Friends", "Create post", "Profile", "Store"]) {
      expect(mobileNavSource).toContain(`aria-label="${label}"`);
    }
    expect(rootSource).toContain('import "./components/product/product-interactions.css"');
    expect(productInteractionsCss).toContain(".product-mobile-nav");
    expect(productInteractionsCss).toContain("min-height: 54px");
    expect(productInteractionsCss).toContain(".product-mobile-nav .product-nav__link svg");
  });

  it("exposes an owner-only profile editor wired to the existing profile and media APIs", () => {
    expect(profileRouteSource).toContain("ProfileEditor");
    expect(profileRouteSource).toContain("isOwnProfile");
    expect(profileEditorSource).toContain("/api/profile/me");
    expect(profileEditorSource).toContain("/api/profile/media");
    expect(profileEditorSource).toContain('method: "PATCH"');
  });
});
