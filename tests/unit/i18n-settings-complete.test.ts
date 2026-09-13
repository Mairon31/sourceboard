import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settings = readFileSync("app/routes/settings.tsx", "utf8");

describe("Settings internationalization and navigation", () => {
  it("uses the global i18n layer and exposes the language selector inside Settings", () => {
    expect(settings).toContain('useI18n');
    expect(settings).toContain('<LanguageSelector');
    expect(settings).toContain('t("settings.title")');
    expect(settings).toContain('t("settings.general.title")');
    expect(settings).toContain('t("settings.security.title")');
    expect(settings).toContain('t("settings.language.title")');
  });

  it("shows the complete Settings section navigation rather than only General and Security", () => {
    for (const id of [
      "settings-general",
      "settings-profile",
      "settings-content",
      "settings-notifications",
      "settings-appearance",
      "settings-language",
      "settings-privacy",
      "settings-accessibility",
      "settings-security",
      "settings-sessions",
    ]) {
      expect(settings).toContain(`["${id}",`);
    }
  });

  it("does not leave the main Settings headings hardcoded in English", () => {
    expect(settings).not.toContain('title="Settings"');
    expect(settings).not.toContain('title="General preferences"');
    expect(settings).not.toContain('title="Account security"');
  });
});
