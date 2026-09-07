import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};

const contracts = read("../../shared/ui/contracts.ts");
const profileStore = read("../../worker/profile/store.ts");

describe("public cosmetic identity contracts", () => {
  it("exposes profile effects on identified public authors", () => {
    expect(contracts).toContain("profileEffect?: ProfileEffectPreset");
  });

  it("uses shared cosmetic preset types in the profile store", () => {
    expect(profileStore).toContain("AvatarFramePreset");
    expect(profileStore).toContain("ProfileEffectPreset");
    expect(profileStore).toContain("NameFontFamily");
  });
});
