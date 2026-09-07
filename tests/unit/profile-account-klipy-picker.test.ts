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
const root = read("../../app/root.tsx");
const storeEffectsCss = read("../../app/components/product/store-effects.css");
const storeResponsiveCss = read("../../app/components/product/store-responsive.css");
const productCss =
  read("../../app/components/product/product.css") +
  read("../../app/components/product/profile-klipy.css");

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

  it("renders the media picker as a stable row-major square grid on mobile", () => {
    expect(productCss).toContain(".product-comment-media-picker__tabs");
    expect(productCss).toContain(".product-comment-media-picker__search");
    expect(productCss).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(productCss).toContain("grid-auto-flow: row");
    expect(productCss).toContain("overflow-y: auto");
    expect(productCss).toContain("aspect-ratio: 1 / 1");
  });

  it("uses real animated GIF media instead of provider preview strips", () => {
    expect(commentThread).toContain("attachment.url ?? attachment.preview");
    expect(commentThread).toContain("item.url || item.preview");
    expect(commentsApi).not.toContain(
      'formatUrl(formats, ["tinygifpreview", "gifpreview", "nanogif"])',
    );
    expect(commentsApi).not.toContain('"tinygif,webp,tinygifpreview,gifpreview"');
  });

  it("renders selected GIFs and stickers as media only without provider chrome", () => {
    expect(commentThread).not.toContain("Powered by KLIPY");
    expect(commentThread).not.toContain("<span>{attachment.type}</span>");
    expect(commentThread).not.toContain("<strong>{attachment.label}</strong>");
    expect(productCss).toContain(".product-comment-attachment--sticker");
    expect(productCss).toContain("background: transparent");
  });

  it("prevents duplicate comment creation from repeated mobile taps", () => {
    expect(commentThread).toContain("submitInFlightRef");
    expect(commentThread).toContain("setSubmitting(true)");
    expect(commentThread).toContain("submitInFlightRef.current = true");
    expect(commentThread).toContain("disabled={submitting || (!body.trim() && !attachment)}");
  });

  it("keeps mobile store effects visually centered while retaining animation", () => {
    expect(storeResponsiveCss).toContain(".product-store-page .product-store-preview--effect::before");
    expect(storeResponsiveCss).toContain(".product-store-page .product-store-preview--effect::after");
    expect(storeResponsiveCss).toContain("top: 42%");
    expect(storeEffectsCss).toContain("animation:");
  });

  it("ships centered animated profile effects with reduced-motion fallback", () => {
    expect(root).toContain('import "./components/product/store-effects.css"');
    expect(storeEffectsCss).toContain("@keyframes sb-fx-orbit");
    expect(storeEffectsCss).toContain("@keyframes sb-fx-pulse");
    expect(storeEffectsCss).toContain("prefers-reduced-motion: reduce");
  });
});
