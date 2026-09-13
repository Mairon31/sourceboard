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
    for (const label of [
      "Primary color",
      "Secondary color",
      "Gradient angle",
      "Duration (ms)",
      "Easing",
      "Intensity",
      "Glow blur (px)",
      "Glow opacity",
      "Particle count",
      "Particle size",
      "Particle speed",
      "Particle spread",
      "Particle path",
    ]) {
      expect(editor).toContain(label);
    }
    expect(editor).toContain("Clone preset");
    expect(editor).toContain("Normalized JSON");
    expect(editor).not.toContain("CSS textarea");
  });

  it("keeps the Preset Laboratory as the preset selector and materializes edits through draft lifecycle", () => {
    const laboratory = read("../../app/components/admin/store/AdminPresetLaboratory.tsx");
    expect(laboratory).toContain("PRESET_FILTERS");
    expect(laboratory).toContain("isActive: false");
    expect(laboratory).toContain("AdminStoreEditor");
    expect(laboratory).toContain("ProfileCosmeticPreview");
  });

  it("documents Creator Pro separately from legacy Community CSS", () => {
    const guide = read("../../app/components/admin/store/AdminCosmeticGuide.tsx");
    for (const contract of [
      "Creator Pro structured schema",
      "Palette and gradient",
      "300ms",
      "60000ms",
      "48 particles",
      "Reduced motion",
      "Avatar frame safe zone",
      "Google Fonts",
      "Legacy / Community CSS",
    ]) {
      expect(guide).toContain(contract);
    }
  });
});
