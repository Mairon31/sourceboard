import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const storeRoute = read("../../app/routes/store.tsx");
const adminStoreRoute = read("../../app/routes/admin-store.tsx");
const adminPacks = read("../../app/components/admin/store/AdminEmotePackManager.tsx");
const routes = read("../../app/routes.ts");
const adminShell = read("../../app/components/admin/AdminShell.tsx");
const storeCss = read("../../app/components/product/store.css");
const catalogApi = read("../../worker/catalog/api.ts");
const storeApi = read("../../worker/store/api.ts");
const storeService = read("../../worker/store/service.ts");
const entitlements = read("../../worker/store/entitlements.ts");
const cosmetics = read("../../shared/store/cosmetics.ts");
const migration = read("../../migrations/0014_store_refresh.sql");

describe("refreshed store experience", () => {
  it("filters the catalog by All, Frame, Profile effects, Name effects, Font and Emotes", () => {
    for (const label of ["All", "Frame", "Profile effects", "Name effects", "Font", "Emotes"]) {
      expect(storeRoute).toContain(`label: "${label}"`);
    }
    expect(storeRoute).toContain("activeFilter");
    expect(storeRoute).toContain("visibleItems");
    expect(storeRoute).toContain("product-store-filter-bar");
    expect(storeCss).toContain(".product-store-filter-bar");
  });

  it("uses real redeem/equip actions and treats admin store access as unlocked", () => {
    expect(storeRoute).toContain("/purchase");
    expect(storeRoute).toContain("/api/me/cosmetics/");
    expect(storeRoute).toContain("adminUnlocked");
    expect(storeRoute).toContain("Admin unlocked");
    expect(storeService).toContain("isStoreAdmin");
    expect(storeService).toContain("allowUnowned");
    expect(storeApi).toContain("isStoreAdmin");
  });

  it("ships a substantially expanded cosmetic catalog with real visual presets", () => {
    for (const preset of [
      "stellar",
      "emerald",
      "rainbow",
      "eclipse",
      "ocean",
      "nova",
      "cyber",
      "gold",
      "shadow",
      "sakura",
      "inferno",
      "crystal",
    ]) {
      expect(cosmetics).toContain(`"${preset}"`);
      expect(storeCss).toContain(`.sb-avatar--frame-${preset}`);
    }
    for (const preset of [
      "star-dust",
      "blue-energy",
      "fire-pulse",
      "pink-hearts",
      "dark-smoke",
      "snow-drift",
      "electric-burst",
      "holy-glow",
      "butterfly",
      "rgb-glitch",
      "moon-mist",
      "leaf-drift",
    ]) {
      expect(cosmetics).toContain(`"${preset}"`);
      expect(storeCss).toContain(`product-store-preview--${preset}`);
    }
    expect(migration.match(/'AVATAR_FRAME'/g)?.length ?? 0).toBeGreaterThanOrEqual(12);
    expect(migration.match(/'PROFILE_EFFECT'/g)?.length ?? 0).toBeGreaterThanOrEqual(12);
    expect(migration.match(/'NAME_FONT'/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
  });

  it("lets admins create, populate and publish emote packs from the admin panel", () => {
    expect(routes).toContain('route("admin/store", "routes/admin-store.tsx")');
    expect(adminShell).toContain('href: "/admin/store"');
    expect(adminStoreRoute).toContain("AdminEmotePackManager");
    expect(adminStoreRoute).toContain("/api/admin/catalog/emote-packs");
    expect(adminPacks).toContain("/api/admin/catalog/emote-packs");
    expect(adminPacks).toContain("/api/admin/catalog/emotes");
    expect(adminPacks).toContain("packId");
    expect(catalogApi).toContain("/api/admin/catalog/emote-packs");
    expect(catalogApi).toContain("emote_packs");
    expect(catalogApi).toContain("store_items");
    expect(catalogApi).toContain("packId");
  });

  it("lets admin and owner roles use pack entitlements without inventory purchases", () => {
    expect(entitlements).toContain("isStoreAdmin");
    expect(storeService).toContain("r.slug IN ('admin', 'owner')");
  });
});
