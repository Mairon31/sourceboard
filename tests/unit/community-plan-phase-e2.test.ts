import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

function expectOrdered(source: string, labels: string[]) {
  let previous = -1;
  for (const label of labels) {
    const index = source.indexOf(label);
    expect(index, `${label} should exist`).toBeGreaterThan(-1);
    expect(index, `${label} should follow the previous entry`).toBeGreaterThan(previous);
    previous = index;
  }
}

describe("community plan phase E2", () => {
  it("organizes Admin Store as Catalog, packs, Community, Presets and Cosmetic Guide", () => {
    const route = read("../../app/routes/admin-store.tsx");
    expect(route).toContain('"PRESETS"');
    expect(route).toContain('"GUIDE"');
    expectOrdered(route, [
      'label: "Catalog"',
      'label: "Emote Packs"',
      'label: "Sticker Packs"',
      'label: "Community"',
      'label: "Presets"',
      'label: "Cosmetic Guide"',
    ]);
    expect(route).toContain("<AdminPresetLaboratory");
    expect(route).toContain("<AdminCosmeticGuide");
  });

  it("lands sticker-only administrators in the Sticker Packs workspace", () => {
    const route = read("../../app/routes/admin-store.tsx");
    expect(route).toContain('access.emoteManage ? "EMOTE_PACKS" : "STICKER_PACKS"');
  });

  it("provides an Admin Preset Laboratory over the real SourceBoard preset registries", () => {
    const lab = read("../../app/components/admin/store/AdminPresetLaboratory.tsx");
    expect(lab).toContain("AVATAR_FRAME_PRESETS");
    expect(lab).toContain("PROFILE_THEME_PRESETS");
    expect(lab).toContain("PROFILE_EFFECT_PRESETS");
    expect(lab).toContain("NAME_EFFECT_PRESETS");
    expect(lab).toContain("NAME_FONT_FAMILIES");
    expectOrdered(lab, [
      'label: "Avatar Frames"',
      'label: "Profile Styles"',
      'label: "Name Effects"',
      'label: "Fonts"',
      'label: "Effects"',
      'label: "Stickers"',
      'label: "Emotes"',
    ]);
    for (const copy of [
      "Preset ID",
      "Configuration",
      "Lifecycle",
      "Edit",
      "Duplicate",
      "Archive",
    ]) {
      expect(lab).toContain(copy);
    }
    expect(lab).toContain("/api/admin/store");
  });

  it("keeps the Cosmetic Guide sourced from the same sanitizer allowlists and exposes live preview", () => {
    const sanitizer = read("../../shared/store/community-css.ts");
    const guide = read("../../app/components/admin/store/AdminCosmeticGuide.tsx");
    expect(sanitizer).toContain("export const COMMUNITY_CSS_ALLOWED_SELECTORS");
    expect(sanitizer).toContain("export const COMMUNITY_CSS_ALLOWED_PROPERTIES");
    expect(sanitizer).toContain("COMMUNITY_CSS_MAX_BYTES = 12 * 1024");
    expect(sanitizer).toContain("COMMUNITY_CSS_MAX_RULES = 24");
    expect(sanitizer).toContain("COMMUNITY_CSS_MAX_KEYFRAMES = 4");
    expect(guide).toContain("COMMUNITY_CSS_ALLOWED_SELECTORS");
    expect(guide).toContain("COMMUNITY_CSS_ALLOWED_PROPERTIES");
    expect(guide).toContain("sanitizeCommunityCosmeticCss");
    for (const slot of [
      ".cosmetic-root",
      ".profile-card",
      ".profile-header",
      ".profile-avatar-area",
      ".profile-name-area",
    ]) {
      expect(guide).toContain(slot);
    }
    expect(guide).toContain("Live preview");
    expect(guide).toContain("COMMUNITY_CSS_MAX_BYTES / 1024");
    expect(guide).toContain("COMMUNITY_CSS_MAX_RULES");
    expect(guide).toContain("COMMUNITY_CSS_MAX_KEYFRAMES");
    expect(guide).toContain("800ms");
    expect(guide).toContain("20s");
  });

  it("orders the public Store filters and sections around Featured then New", () => {
    const store = read("../../app/routes/store.tsx");
    expectOrdered(store, [
      'label: "Profile Themes"',
      'label: "Avatar Frames"',
      'label: "Profile Effects"',
      'label: "Name Effects"',
      'label: "Fonts"',
      'label: "Emotes"',
      'label: "Stickers"',
      'label: "Community"',
    ]);
    expectOrdered(store, ['title="Featured"', 'title="New"', 'title="Owned"']);
  });
});
