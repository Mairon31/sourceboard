import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sanitizeCommunityCosmeticCss } from "../../shared/store/community-css";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

describe("community plan phase D", () => {
  it("scopes allowlisted cosmetic CSS to one community cosmetic root", () => {
    const result = sanitizeCommunityCosmeticCss(
      `.cosmetic-root { --accent: #ff88cc; opacity: .95; }\n.cosmetic-root .profile-card { background: linear-gradient(120deg, #111, #335); border-radius: 20px; }\n.cosmetic-root .profile-name-area { color: #ffd8ef; transform: scale(1.03); }`,
      "demo-item",
    );
    expect(result.scopedCss).toContain('[data-community-cosmetic~="demo-item"]');
    expect(result.scopedCss).toContain('[data-community-cosmetic~="demo-item"] .profile-card');
    expect(result.scopedCss).not.toContain(".cosmetic-root {");
  });

  it("rejects selectors and resource or layout escapes outside the sandbox", () => {
    expect(() => sanitizeCommunityCosmeticCss("body { color: red; }", "demo")).toThrow();
    expect(() =>
      sanitizeCommunityCosmeticCss(
        '.cosmetic-root { background: url("https://evil.test/a.png"); }',
        "demo",
      ),
    ).toThrow();
    expect(() =>
      sanitizeCommunityCosmeticCss(
        '.cosmetic-root { background: image-set("https://evil.test/a.png" 1x); }',
        "demo",
      ),
    ).toThrow();
    expect(() =>
      sanitizeCommunityCosmeticCss(
        String.raw`.cosmetic-root { background: u\72l("https://evil.test/a.png"); }`,
        "demo",
      ),
    ).toThrow();
    expect(() =>
      sanitizeCommunityCosmeticCss('@import "https://evil.test/x.css";', "demo"),
    ).toThrow();
    expect(() =>
      sanitizeCommunityCosmeticCss(".cosmetic-root { position: fixed; }", "demo"),
    ).toThrow();
    expect(() =>
      sanitizeCommunityCosmeticCss(".cosmetic-root { z-index: 999999; }", "demo"),
    ).toThrow();
  });

  it("rejects custom-property sandbox escapes", () => {
    for (const css of [
      ".cosmetic-root { --accent: 9999px; border-radius: var(--accent); }",
      ".cosmetic-root { --cosmetic-fx-size: 9999px; }",
    ]) {
      expect(() => sanitizeCommunityCosmeticCss(css, "demo")).toThrow();
    }
  });

  it("rejects relative units in bounded geometry", () => {
    for (const css of [
      ".cosmetic-root .profile-card { border-width: 25vw; }",
      ".cosmetic-root .profile-name-area { letter-spacing: 20rem; }",
      ".cosmetic-root .profile-card { box-shadow: 0 0 100vmax #000; }",
      ".cosmetic-root .profile-card { border-radius: 1000%; }",
    ]) {
      expect(() => sanitizeCommunityCosmeticCss(css, "demo")).toThrow();
    }
  });

  it("rejects unbounded transform arguments", () => {
    for (const css of [
      ".cosmetic-root .profile-name-area { transform: translateX(100vw); }",
      ".cosmetic-root .profile-name-area { transform: scale(1, 50); }",
      ".cosmetic-root .profile-name-area { transform: rotate(999turn); }",
    ]) {
      expect(() => sanitizeCommunityCosmeticCss(css, "demo")).toThrow();
    }
  });

  it("rejects extreme filter arguments", () => {
    for (const css of [
      ".cosmetic-root .profile-card { filter: blur(100vw); }",
      ".cosmetic-root .profile-card { filter: brightness(999); }",
      ".cosmetic-root .profile-card { filter: saturate(999); }",
      ".cosmetic-root .profile-card { filter: contrast(999); }",
      ".cosmetic-root .profile-card { filter: hue-rotate(999turn); }",
    ]) {
      expect(() => sanitizeCommunityCosmeticCss(css, "demo")).toThrow();
    }
  });

  it("keeps bounded filter arguments", () => {
    const result = sanitizeCommunityCosmeticCss(
      ".cosmetic-root .profile-card { filter: blur(4px) brightness(1.1) saturate(120%) contrast(.9) hue-rotate(30deg); }",
      "demo",
    );
    expect(result.scopedCss).toContain("blur(4px)");
    expect(result.scopedCss).toContain("hue-rotate(30deg)");
  });

  it("provides a dedicated authenticated Store creator with live CSS preview", () => {
    const routes = read("../../app/routes.ts");
    const route = read("../../app/routes/store-create.tsx");
    const studio = read("../../app/components/product/CommunityCosmeticStudio.tsx");
    expect(routes).toContain('route("store/create", "routes/store-create.tsx")');
    expect(route).toContain("CommunityCosmeticStudio");
    expect(studio).toContain("Custom CSS");
    expect(studio).toContain("sanitizeCommunityCosmeticCss");
    expect(studio).toContain("Save draft");
    expect(studio).toContain("Submit for review");
  });

  it("implements community publishing, moderation and creator attribution without exposing unapproved items", () => {
    const migration = read("../../migrations/0025_community_cosmetic_lifecycle.sql");
    const api = read("../../worker/store/community-api.ts");
    const service = read("../../worker/store/service.ts");
    expect(migration).toContain("community_state");
    expect(migration).toContain("moderation_state");
    for (const state of ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"]) {
      expect(migration).toContain(`'${state}'`);
    }
    for (const action of ["APPROVE", "REJECT", "HIDE", "RESTORE", "ARCHIVE", "REMOVE"]) {
      expect(api).toContain(`"${action}"`);
    }
    expect(service).toContain("community_state = 'PUBLISHED'");
    expect(service).toContain("moderation_state = 'CLEAR'");
    expect(service).toContain("creatorUsername");
    expect(service).toContain("creatorDisplayName");
  });

  it("uses compare-and-set writes so stale concurrent moderation decisions cannot overwrite a newer state", () => {
    const api = read("../../worker/store/community-api.ts");
    expect(api).toContain("AND community_state = ? AND moderation_state = ?");
    expect(api).toContain("transitionResult");
    expect(api).toContain("STALE_COMMUNITY_TRANSITION");
  });

  it("shows Community after Stickers and attributes public cards by username", () => {
    const store = read("../../app/routes/store.tsx");
    const card = read("../../app/components/product/StoreItemCard.tsx");
    const stickers = store.indexOf('label: "store.filter.stickers"');
    const community = store.indexOf('label: "store.filter.community"');
    expect(stickers).toBeGreaterThan(-1);
    expect(community).toBeGreaterThan(stickers);
    expect(store).not.toContain("<CommunityCosmeticStudio />");
    expect(card).toContain('t("store.createdBy"');
    expect(card).not.toContain("creatorUserId}");
  });
});
