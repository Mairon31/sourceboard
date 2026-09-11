import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AVATAR_FRAME_PRESETS,
  NAME_EFFECT_PRESETS,
  PROFILE_BANNER_PRESETS,
  PROFILE_EFFECT_PRESETS,
} from "../../shared/store/cosmetics";
import {
  COSMETIC_VISUAL_NAMESPACE,
  normalizeCosmeticVisualConfig,
} from "../../shared/store/custom-cosmetics";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("remaining product overhaul contracts", () => {
  it("ships the expanded first-party cosmetic preset catalog", () => {
    expect(AVATAR_FRAME_PRESETS).toEqual(
      expect.arrayContaining(["rainbow", "eclipse", "cyber", "sakura", "crystal"]),
    );
    expect(PROFILE_BANNER_PRESETS).toEqual(
      expect.arrayContaining(["aurora", "ocean-glass", "prism-grid", "silver-wave"]),
    );
    expect(PROFILE_EFFECT_PRESETS).toEqual(
      expect.arrayContaining(["blue-energy", "pink-hearts", "snow-drift", "rgb-glitch"]),
    );
    expect(NAME_EFFECT_PRESETS).toEqual(
      expect.arrayContaining(["hologram", "void", "solar", "terminal", "chrome"]),
    );
  });

  it("accepts only bounded allowlisted custom cosmetic visuals", () => {
    expect(
      normalizeCosmeticVisualConfig({
        namespace: COSMETIC_VISUAL_NAMESPACE,
        visual: {
          foregroundColor: "#AABBCC",
          borderWidth: 3,
          glowSize: 20,
          opacity: 0.8,
          animation: "shimmer",
          animationDurationMs: 1800,
        },
      }),
    ).toEqual({
      namespace: COSMETIC_VISUAL_NAMESPACE,
      visual: {
        foregroundColor: "#aabbcc",
        borderWidth: 3,
        glowSize: 20,
        opacity: 0.8,
        animation: "shimmer",
        animationDurationMs: 1800,
      },
    });

    expect(
      normalizeCosmeticVisualConfig({
        namespace: COSMETIC_VISUAL_NAMESPACE,
        visual: { backgroundImage: "url(javascript:alert(1))" },
      }),
    ).toBeNull();
    expect(
      normalizeCosmeticVisualConfig({
        namespace: COSMETIC_VISUAL_NAMESPACE,
        visual: { glowSize: 1000 },
      }),
    ).toBeNull();
    expect(
      normalizeCosmeticVisualConfig({
        namespace: "unsafe.namespace",
        visual: { foregroundColor: "#ffffff" },
      }),
    ).toBeNull();
  });

  it("loads only Recent on Home and fetches alternate feeds on demand", () => {
    const home = read("../../app/routes/_index.tsx");
    const feedResource = read("../../app/routes/feed-resource.tsx");
    const routes = read("../../app/routes.ts");

    expect(home).toContain("const recent = await service.listFeed");
    expect(home).toContain("feedCacheKey");
    expect(home).toContain("loadedKeys.has(key)");
    expect(home).toContain("/resources/feed/${encodeURIComponent(nextFeed)}");
    expect(home).toContain('role="tablist"');
    expect(home).toContain('role="tab"');
    expect(home).toContain("aria-selected={feed === option.value}");
    expect(home).toContain("handleFeedKeyDown");
    expect(home).toContain('role="tabpanel"');
    expect(feedResource).toContain("service.listFeed({");
    expect(routes).toContain('route("resources/feed/:kind", "routes/feed-resource.tsx")');
  });
});
