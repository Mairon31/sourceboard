import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const profileRoute = read("../../app/routes/profile.tsx");
const accountActions = read("../../app/components/product/ProfileAccountActions.tsx");
const commentThread = read("../../app/components/product/CommentThread.tsx");
const commentsApi = read("../../worker/comments/api.ts");
const productCss = read("../../app/components/product/product.css");

describe("profile account actions and KLIPY media picker", () => {
  it("shows Settings and current-session logout only on the owner profile", () => {
    expect(profileRoute).toContain("ProfileAccountActions");
    expect(profileRoute).toContain("isOwnProfile ? <ProfileAccountActions /> : null");
    expect(accountActions).toContain('to="/settings"');
    expect(accountActions).toContain('fetch("/api/auth/logout"');
    expect(accountActions).toContain("readCsrfToken()");
    expect(accountActions).toContain('window.location.assign("/login")');
  });

  it("loads KLIPY featured media when the picker opens and supports GIF/sticker tabs", () => {
    expect(commentThread).toContain("loadMedia");
    expect(commentThread).toContain("useEffect(() =>");
    expect(commentThread).toContain('role="tablist"');
    expect(commentThread).toContain('role="tab"');
    expect(commentThread).toContain("onKindChange");
    expect(commentThread).toContain("product-comment-media-picker__results");
  });

  it("allows authenticated same-site GET media reads without requiring an Origin header", () => {
    const klipyHandler = commentsApi.slice(
      commentsApi.indexOf("async function searchKlipy"),
      commentsApi.indexOf("function database"),
    );

    expect(klipyHandler).not.toContain("assertSameOrigin(request)");
    expect(klipyHandler).toContain("requiredViewer(request, env)");
    expect(klipyHandler).toContain("RATE_LIMIT_CONTENT");
    expect(klipyHandler).toContain('"https://api.klipy.com/v2/featured"');
    expect(klipyHandler).toContain('"https://api.klipy.com/v2/search"');
  });

  it("renders the media picker as a compact Instagram-style visual grid", () => {
    expect(productCss).toContain(".product-comment-media-picker__tabs");
    expect(productCss).toContain(".product-comment-media-picker__search");
    expect(productCss).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(productCss).toContain("overflow-y: auto");
    expect(productCss).toContain("aspect-ratio: 1");
  });
});
