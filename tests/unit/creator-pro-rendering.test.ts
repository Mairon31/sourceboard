import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  creatorProParticleNodeCount,
  creatorProVisualStyle,
} from "../../app/components/product/creator-pro-visual";
import type { CosmeticVisualConfigV1 } from "../../shared/store/cosmetic-config";

const config: CosmeticVisualConfigV1 = {
  schemaVersion: 1,
  palette: ["#112233", "#445566"],
  gradient: {
    angle: 135,
    stops: [
      { color: "#112233", position: 0 },
      { color: "#445566", position: 1 },
    ],
  },
  animation: {
    durationMs: 12_000,
    delayMs: 250,
    easing: "ease-in-out",
    direction: "alternate",
    iterations: "infinite",
  },
  glow: { blurPx: 16, opacity: 0.5 },
  opacity: 0.9,
  particles: { count: 48, size: 1, speed: 1, spread: 0.75, path: "drift" },
  intensity: 0.8,
};

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");

describe("Creator Pro canonical rendering", () => {
  it("maps normalized schema v1 into deterministic theme/name visual styles", () => {
    const theme = creatorProVisualStyle(config, "theme") as Record<string, unknown>;
    expect(theme.background).toContain("linear-gradient(135deg");
    expect(theme.background).toContain("#112233 0%");
    expect(theme.background).toContain("#445566 100%");
    expect(theme.animationDuration).toBe("12000ms");
    expect(theme.animationDelay).toBe("250ms");
    expect(theme.opacity).toBe(0.9);

    const name = creatorProVisualStyle(config, "name") as Record<string, unknown>;
    expect(name.backgroundImage).toContain("linear-gradient(135deg");
    expect(name.color).toBe("transparent");
  });

  it("caps structured particle DOM density by render context without changing stored config", () => {
    expect(creatorProParticleNodeCount(config, "profile")).toBe(48);
    expect(creatorProParticleNodeCount(config, "preview")).toBe(24);
    expect(creatorProParticleNodeCount(config, "compact")).toBe(8);
    expect(config.particles?.count).toBe(48);
  });

  it("threads structured equipped visuals from D1 through public profile DTO into canonical primitives", () => {
    const profileStore = read("../../worker/profile/store.ts");
    const profileTypes = read("../../worker/profile/types.ts");
    const hero = read("../../app/components/product/ProfileHero.tsx");
    const card = read("../../app/components/product/ProfileIdentityCard.tsx");
    const identity = read("../../app/components/product/CosmeticIdentity.tsx");

    expect(profileStore).toContain("parseCreatorProStoreConfig");
    expect(profileStore).toContain("creatorPro");
    expect(profileTypes).toContain("creatorPro?: CreatorProIdentityVisuals");
    expect(hero).toContain("creatorPro={profile.cosmetics?.creatorPro}");
    expect(card).toContain("creatorPro?: CreatorProIdentityVisuals");
    expect(identity).toContain("creatorPro?: CreatorProIdentityVisuals");
  });

  it("uses the same structured config in Admin canonical preview", () => {
    const editor = read("../../app/components/admin/store/AdminStoreEditor.tsx");
    const preview = read("../../app/components/product/CosmeticPreview.tsx");
    expect(editor).toContain("creatorPro={creatorConfig ?? initialCreatorConfig ?? undefined}");
    expect(preview).toContain("creatorPro?: CosmeticVisualConfigV1");
  });
});
