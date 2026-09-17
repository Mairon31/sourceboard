import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");

describe("Admin Creator Pro cosmetic editor", () => {
  it("connects the structured editor to the existing Store catalog editor and canonical preview", () => {
    const storeEditor = read("../../app/components/admin/store/AdminStoreEditor.tsx");
    expect(storeEditor).toContain("CosmeticConfigEditor");
    expect(storeEditor).toContain("CosmeticPreview");
    expect(storeEditor).toContain("mergeCreatorProStoreConfig");
    expect(storeEditor).toContain("parseCreatorProStoreConfig");
  });

  it("offers the required bounded structured controls instead of a Creator Pro CSS editor", () => {
    const editor = read("../../app/components/admin/store/CosmeticConfigEditor.tsx");
    expect(editor).toContain("useI18n");
    for (const key of [
      "admin.creatorPro.ariaLabel",
      "admin.creatorPro.title",
      "admin.creatorPro.schema",
      "admin.creatorPro.clone",
      "admin.creatorPro.primaryColor",
      "admin.creatorPro.secondaryColor",
      "admin.creatorPro.gradientAngle",
      "admin.creatorPro.duration",
      "admin.creatorPro.easing",
      "admin.creatorPro.intensity",
      "admin.creatorPro.glowBlur",
      "admin.creatorPro.glowOpacity",
      "admin.creatorPro.particleCount",
      "admin.creatorPro.particleSize",
      "admin.creatorPro.particleSpeed",
      "admin.creatorPro.particleSpread",
      "admin.creatorPro.particlePath",
      "admin.creatorPro.validSchema",
      "admin.creatorPro.invalidConfig",
      "admin.creatorPro.normalizedJson",
    ]) {
      expect(editor).toContain(`t("${key}")`);
    }
    expect(editor).not.toContain('label="Primary color"');
    expect(editor).not.toContain(">Clone preset<");
    expect(editor).not.toContain(">Normalized JSON<");
    expect(editor).not.toContain("CSS textarea");
  });

  it("keeps the Preset Laboratory as the preset selector and materializes edits through draft lifecycle", () => {
    const laboratory = read("../../app/components/admin/store/AdminPresetLaboratory.tsx");
    expect(laboratory).toContain("PRESET_FILTERS");
    expect(laboratory).toContain("isActive: false");
    expect(laboratory).toContain("AdminStoreEditor");
    expect(laboratory).toContain("ProfileCosmeticPreview");
  });

  it("localizes all user-facing Preset Laboratory copy", () => {
    const laboratory = read("../../app/components/admin/store/AdminPresetLaboratory.tsx");
    expect(laboratory).toContain('import { useI18n } from "../../../i18n/I18nProvider";');
    for (const key of [
      "admin.presetLab.ariaLabel",
      "admin.presetLab.eyebrow",
      "admin.presetLab.title",
      "admin.presetLab.description",
      "admin.presetLab.count",
      "admin.presetLab.category",
      "admin.presetLab.presetId",
      "admin.presetLab.lifecycle",
      "admin.presetLab.configuration",
      "admin.presetLab.edit",
      "admin.presetLab.duplicate",
      "admin.presetLab.archive",
      "admin.presetLab.packWorkspace",
      "admin.presetLab.materializeDescription",
      "admin.presetLab.materializeFailed",
      "admin.presetLab.actionFailed",
      "admin.presetLab.packManaged",
      "admin.presetLab.updated",
      "admin.presetLab.duplicated",
      "admin.presetLab.archived",
      "admin.presetLab.filter.avatarFrames",
      "admin.presetLab.filter.profileStyles",
      "admin.presetLab.filter.nameEffects",
      "admin.presetLab.filter.fonts",
      "admin.presetLab.filter.effects",
      "admin.presetLab.filter.stickers",
      "admin.presetLab.filter.emotes",
    ]) {
      expect(laboratory).toContain(`t("${key}"`);
    }
    expect(laboratory).not.toContain('label: "Avatar Frames"');
    expect(laboratory).not.toContain(">Inspect the internal cosmetic registry<");
    expect(laboratory).not.toContain(">Preset ID<");
  });

  it("documents Creator Pro separately from legacy Community CSS", () => {
    const english = read("../../app/i18n/messages/locales/en/admin.ts");
    for (const key of [
      "admin.cosmeticGuide.creatorTitle",
      "admin.cosmeticGuide.paletteTitle",
      "admin.cosmeticGuide.durationRule",
      "admin.cosmeticGuide.motionDescription",
      "admin.cosmeticGuide.avatarSafeZoneRule",
      "admin.cosmeticGuide.googleFontsRule",
      "admin.cosmeticGuide.legacyTitle",
    ]) {
      expect(english).toContain(`"${key}"`);
    }
  });

  it("localizes the cosmetic guide and sandbox controls", () => {
    const guide = read("../../app/components/admin/store/AdminCosmeticGuide.tsx");
    expect(guide).toContain('import { useI18n } from "../../../i18n/I18nProvider";');
    for (const key of [
      "admin.cosmeticGuide.ariaLabel",
      "admin.cosmeticGuide.creatorEyebrow",
      "admin.cosmeticGuide.creatorTitle",
      "admin.cosmeticGuide.creatorDescription",
      "admin.cosmeticGuide.paletteTitle",
      "admin.cosmeticGuide.paletteRule",
      "admin.cosmeticGuide.gradientRule",
      "admin.cosmeticGuide.opacityRule",
      "admin.cosmeticGuide.glowRule",
      "admin.cosmeticGuide.paletteDescription",
      "admin.cosmeticGuide.motionTitle",
      "admin.cosmeticGuide.durationRule",
      "admin.cosmeticGuide.delayRule",
      "admin.cosmeticGuide.iterationsRule",
      "admin.cosmeticGuide.particlesRule",
      "admin.cosmeticGuide.pathsRule",
      "admin.cosmeticGuide.motionDescription",
      "admin.cosmeticGuide.rendererTitle",
      "admin.cosmeticGuide.canonicalRendererRule",
      "admin.cosmeticGuide.avatarSafeZoneRule",
      "admin.cosmeticGuide.nameEffectRule",
      "admin.cosmeticGuide.googleFontsRule",
      "admin.cosmeticGuide.compatibilityEyebrow",
      "admin.cosmeticGuide.legacyTitle",
      "admin.cosmeticGuide.legacyDescription",
      "admin.cosmeticGuide.rootTitle",
      "admin.cosmeticGuide.rootDescription",
      "admin.cosmeticGuide.allowedPropertiesTitle",
      "admin.cosmeticGuide.allowedPropertiesDescription",
      "admin.cosmeticGuide.safetyTitle",
      "admin.cosmeticGuide.maxBytes",
      "admin.cosmeticGuide.maxRules",
      "admin.cosmeticGuide.maxKeyframes",
      "admin.cosmeticGuide.animationDuration",
      "admin.cosmeticGuide.localKeyframes",
      "admin.cosmeticGuide.transforms",
      "admin.cosmeticGuide.scale",
      "admin.cosmeticGuide.responsive",
      "admin.cosmeticGuide.playgroundTitle",
      "admin.cosmeticGuide.cssLabel",
      "admin.cosmeticGuide.validCss",
      "admin.cosmeticGuide.livePreview",
      "admin.cosmeticGuide.previewDescription",
    ]) {
      expect(guide).toContain(`t("${key}"`);
    }
    expect(guide).not.toContain(">Creator Pro structured schema<");
    expect(guide).not.toContain('label="Sandboxed cosmetic CSS"');
  });

  it("surfaces network failures from the admin save flow and keeps the error localized", () => {
    const editor = read("../../app/components/admin/store/AdminStoreEditor.tsx");
    expect(editor).toContain('import { useI18n } from "../../../i18n/I18nProvider";');
    expect(editor).toContain('setError(t("admin.store.updateFailed"));');
    expect(editor).toContain("} catch {");
  });

  it("localizes the catalog editor copy through the central message catalog", () => {
    const editor = read("../../app/components/admin/store/AdminStoreEditor.tsx");
    for (const key of [
      "admin.store.editor.invalidStoredConfig",
      "admin.store.editor.invalidConfigJson",
      "admin.store.editor.updateFallback",
      "admin.store.editor.editItem",
      "admin.store.editor.saveChanges",
      "admin.store.editor.name",
      "admin.store.editor.description",
      "admin.store.editor.pricePoints",
      "admin.store.editor.sortOrder",
      "admin.store.editor.cosmeticPreviewAria",
      "admin.store.editor.canonicalPreview",
      "admin.store.editor.rendererDescription",
      "admin.store.editor.invalidIdentity",
      "admin.store.editor.identityMetadata",
      "admin.store.editor.configJson",
      "admin.store.editor.packConfigHelp",
    ]) {
      expect(editor).toContain(`t("${key}")`);
    }
    for (const literal of [
      "Stored config JSON must contain a valid object before Creator Pro can save it.",
      "Config JSON must contain valid JSON.",
      "Edit catalog item",
      "Canonical cosmetic preview",
      "Pack configuration only.",
    ]) {
      expect(editor).not.toContain(literal);
    }
    expect(editor).toContain('t("common.close")');
    expect(editor).toContain('t("common.cancel")');
  });
});
