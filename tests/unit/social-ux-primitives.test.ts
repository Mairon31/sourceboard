import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlays = readFileSync(
  new URL("../../app/components/ui/overlays.tsx", import.meta.url),
  "utf8",
);
const share = readFileSync(
  new URL("../../app/components/product/ShareAction.tsx", import.meta.url),
  "utf8",
);
const postCard = readFileSync(
  new URL("../../app/components/product/PostCard.tsx", import.meta.url),
  "utf8",
);

describe("social UX primitives", () => {
  it("uses the shared modal for confirmation and exposes busy/error states", () => {
    expect(overlays).toContain("export function ConfirmDialog");
    expect(overlays).toContain("<Modal");
    expect(overlays).toContain("aria-live");
  });

  it("tries Web Share before clipboard and exposes copied feedback", () => {
    expect(share).toContain("navigator.share");
    expect(share.indexOf("navigator.share")).toBeLessThan(share.indexOf("navigator.clipboard"));
    expect(share).toContain('setStatus("copied")');
    expect(share).toContain('role="alert"');
  });

  it("resolves stable short links for posts without weakening unavailable-target handling", () => {
    expect(postCard).toContain('target={{ resourceType: "POST", resourceId: post.id }}');
    expect(share).toContain('fetch("/api/share-links"');
    expect(share).toContain("response.status >= 500");
    expect(share).toContain('searchParams.get("lang")');
    expect(share).toContain("SHARE_LOCALES.has(locale)");
  });
});
