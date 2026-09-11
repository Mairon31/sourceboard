import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");

describe("Cosmetic presentation overhaul", () => {
  it("keeps profile effects out of avatar and name identity", () => {
    const identity = read("../../app/components/product/CosmeticIdentity.tsx");
    expect(identity).not.toContain("profileEffect");
    expect(identity).not.toContain("cosmetic-identity--effect-");
  });

  it("introduces separate theme and effect renderers", () => {
    expect(read("../../app/components/product/ProfileThemeLayer.tsx")).toContain(
      "data-profile-theme",
    );
    expect(read("../../app/components/product/ProfileEffectLayer.tsx")).toContain(
      "data-profile-effect",
    );
  });

  it("composes profile theme and effect layers at the profile card boundary", () => {
    const card = read("../../app/components/product/ProfileIdentityCard.tsx");
    expect(card).toContain("<ProfileThemeLayer");
    expect(card).toContain("<ProfileEffectLayer");
  });
});
