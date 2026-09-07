import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const commentThread = read("../../app/components/product/CommentThread.tsx");
const productCss = read("../../app/components/product/product.css");
const klipyCss = read("../../app/components/product/profile-klipy.css");
const storeRoute = read("../../app/routes/store.tsx");
const storeApi = read("../../worker/store/api.ts");
const profileRoute = read("../../app/routes/profile.tsx");
const accountActions = read("../../app/components/product/ProfileAccountActions.tsx");

describe("mobile comments, store and account regressions", () => {
  it("keeps cosmetic identity in the comment header so media can use the full mobile width", () => {
    expect(commentThread).toContain('className="product-comment__identity"');
    expect(productCss).toContain(".product-comment__identity");
    expect(productCss).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("pins KLIPY media inside square Safari-safe picker cells", () => {
    expect(klipyCss).toContain("align-items: start");
    expect(klipyCss).toContain("aspect-ratio: 1 / 1");
    expect(klipyCss).toContain("position: absolute");
    expect(klipyCss).toContain("inset: 0");
    expect(klipyCss).toContain("object-fit: contain");
  });

  it("offers an explicit unequip action for equipped cosmetics", () => {
    expect(storeRoute).toContain("async function unequip");
    expect(storeRoute).toContain('return "Unequip"');
    expect(storeRoute).toContain('method: "DELETE"');
    expect(storeApi).toContain('request.method === "DELETE"');
    expect(storeApi).toContain("service.unequip");
  });

  it("shows Admin Panel in Account Options only when admin.access is granted", () => {
    expect(profileRoute).toContain("loadAdminAccess");
    expect(profileRoute).toContain("canAccessAdmin");
    expect(profileRoute).toContain("<ProfileAccountActions canAccessAdmin={canAccessAdmin} />");
    expect(accountActions).toContain("canAccessAdmin");
    expect(accountActions).toContain('to="/admin"');
  });
});
