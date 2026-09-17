import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AVATAR_FRAME_DEFINITIONS,
  AVATAR_STAGE_LAYER_ORDER,
} from "../../app/components/product/avatar-frame-definitions";
import { AVATAR_FRAME_PRESETS, isAvatarFramePreset } from "../../shared/store/cosmetics";

const catalog = readFileSync(
  resolve(import.meta.dirname, "../../worker/store/builtin-catalog.ts"),
  "utf8",
);

const CHEAP_FRAMES = [
  ["simple-blue", 250],
  ["cyan", 300],
  ["purple", 350],
  ["pink", 350],
  ["green", 300],
  ["red", 300],
  ["gold", 600],
  ["white", 250],
  ["dark", 250],
  ["pastel", 450],
  ["double-blue", 550],
  ["thin-neon", 650],
] as const;

describe("low-cost avatar frame catalog", () => {
  it("registers each deterministic preset through the canonical AvatarStage registry", () => {
    for (const [preset] of CHEAP_FRAMES) {
      expect(isAvatarFramePreset(preset)).toBe(true);
      expect(AVATAR_FRAME_DEFINITIONS[preset].parts.length).toBeGreaterThan(0);
      expect(
        AVATAR_FRAME_DEFINITIONS[preset].parts.every((part) =>
          AVATAR_STAGE_LAYER_ORDER.includes(part.geometry.layer),
        ),
      ).toBe(true);
    }
    expect(AVATAR_FRAME_PRESETS).toHaveLength(70);
  });

  it("seeds each cheap frame with a stable id, low price and matching preset", () => {
    for (const [preset, price] of CHEAP_FRAMES) {
      expect(catalog).toContain(`'store-frame-${preset}'`);
      expect(catalog).toContain(`, ${price}, '{"preset":"${preset}"}'`);
    }
  });

  it("keeps cheap frame decoration on AvatarStage shared variables", () => {
    const stage = readFileSync(
      resolve(import.meta.dirname, "../../app/components/product/avatar-stage.css"),
      "utf8",
    );
    for (const [preset] of CHEAP_FRAMES) {
      expect(stage).toContain(`data-avatar-frame="${preset}"`);
    }
    expect(stage).toContain("--avatar-frame-color");
    expect(stage).toContain("--avatar-frame-glow");
  });
});
