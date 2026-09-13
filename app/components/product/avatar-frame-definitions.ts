import {
  AVATAR_FRAME_PRESETS,
  type AvatarFramePreset,
} from "../../../shared/store/cosmetics";
import type {
  AvatarFrameDefinition,
  AvatarFrameGeometry,
  AvatarStageLayer,
} from "./cosmetic-render-types";

const DEFAULT_RING: AvatarFrameGeometry = {
  layer: "inner-ring",
  anchor: "center",
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

const STRUCTURAL: Partial<Record<AvatarFramePreset, readonly AvatarFrameGeometry[]>> = {
  "cat-ears": [
    { layer: "top-ornament", anchor: "top-left", scale: 0.9, offsetX: -0.16, offsetY: -0.2, rotation: -10 },
    { layer: "top-ornament", anchor: "top-right", scale: 0.9, offsetX: 0.16, offsetY: -0.2, rotation: 10 },
  ],
  "cat-ears-black": [
    { layer: "top-ornament", anchor: "top-left", scale: 0.9, offsetX: -0.16, offsetY: -0.2, rotation: -10 },
    { layer: "top-ornament", anchor: "top-right", scale: 0.9, offsetX: 0.16, offsetY: -0.2, rotation: 10 },
  ],
  "cat-ears-white": [
    { layer: "top-ornament", anchor: "top-left", scale: 0.9, offsetX: -0.16, offsetY: -0.2, rotation: -10 },
    { layer: "top-ornament", anchor: "top-right", scale: 0.9, offsetX: 0.16, offsetY: -0.2, rotation: 10 },
  ],
  "fox-ears": [
    { layer: "top-ornament", anchor: "top-left", scale: 1, offsetX: -0.18, offsetY: -0.24, rotation: -12 },
    { layer: "top-ornament", anchor: "top-right", scale: 1, offsetX: 0.18, offsetY: -0.24, rotation: 12 },
  ],
  "fox-spirit": [
    { layer: "top-ornament", anchor: "top-left", scale: 1, offsetX: -0.18, offsetY: -0.24, rotation: -12 },
    { layer: "top-ornament", anchor: "top-right", scale: 1, offsetX: 0.18, offsetY: -0.24, rotation: 12 },
    { layer: "orbit", anchor: "center", scale: 1.18, offsetX: 0, offsetY: 0, rotation: 0, animationDurationMs: 6200, intensity: 0.7 },
  ],
  wings: [
    { layer: "side-ornament", anchor: "left", scale: 1, offsetX: -0.28, offsetY: 0.04, rotation: -12 },
    { layer: "side-ornament", anchor: "right", scale: 1, offsetX: 0.28, offsetY: 0.04, rotation: 12 },
  ],
  "cyber-wings": [
    { layer: "side-ornament", anchor: "left", scale: 1.08, offsetX: -0.3, offsetY: 0.02, rotation: -8 },
    { layer: "side-ornament", anchor: "right", scale: 1.08, offsetX: 0.3, offsetY: 0.02, rotation: 8 },
  ],
  "pixel-wings": [
    { layer: "side-ornament", anchor: "left", scale: 1.08, offsetX: -0.3, offsetY: 0.02, rotation: -5 },
    { layer: "side-ornament", anchor: "right", scale: 1.08, offsetX: 0.3, offsetY: 0.02, rotation: 5 },
  ],
  "devil-horns": [
    { layer: "top-ornament", anchor: "top-left", scale: 0.9, offsetX: -0.14, offsetY: -0.2, rotation: -20 },
    { layer: "top-ornament", anchor: "top-right", scale: 0.9, offsetX: 0.14, offsetY: -0.2, rotation: 20 },
  ],
  "celestial-horns": [
    { layer: "top-ornament", anchor: "top-left", scale: 0.96, offsetX: -0.15, offsetY: -0.21, rotation: -18 },
    { layer: "top-ornament", anchor: "top-right", scale: 0.96, offsetX: 0.15, offsetY: -0.21, rotation: 18 },
  ],
  "angel-halo": [
    { layer: "top-ornament", anchor: "top", scale: 1, offsetX: 0, offsetY: -0.22, rotation: 0, animationDurationMs: 3400 },
  ],
  "electric-halo": [
    { layer: "top-ornament", anchor: "top", scale: 1.04, offsetX: 0, offsetY: -0.22, rotation: 0, animationDurationMs: 2600, intensity: 0.9 },
  ],
  crown: [
    { layer: "top-ornament", anchor: "top", scale: 1, offsetX: 0, offsetY: -0.22, rotation: 0 },
  ],
  "crystal-crown": [
    { layer: "top-ornament", anchor: "top", scale: 1.04, offsetX: 0, offsetY: -0.23, rotation: 0 },
  ],
  "orbit-planets": [
    { layer: "orbit", anchor: "center", scale: 1.2, offsetX: 0, offsetY: 0, rotation: 0, animationDurationMs: 6500 },
  ],
  "comet-orbit": [
    { layer: "orbit", anchor: "center", scale: 1.22, offsetX: 0, offsetY: 0, rotation: 0, animationDurationMs: 4400, intensity: 0.85 },
  ],
  "black-hole": [
    { layer: "outer-ring", anchor: "center", scale: 1.12, offsetX: 0, offsetY: 0, rotation: 0, animationDurationMs: 5800, intensity: 0.9 },
  ],
  "void-lens": [
    { layer: "outer-ring", anchor: "center", scale: 1.13, offsetX: 0, offsetY: 0, rotation: 0, animationDurationMs: 5200, intensity: 0.86 },
  ],
  "sakura-petals": [
    { layer: "foreground", anchor: "center", scale: 1.12, offsetX: 0, offsetY: 0, rotation: 0, animationDurationMs: 5500 },
  ],
  "floral-ring": [
    { layer: "outer-ring", anchor: "center", scale: 1.12, offsetX: 0, offsetY: 0, rotation: 0 },
  ],
};

function defaultDefinition(preset: AvatarFramePreset): AvatarFrameDefinition {
  const parts = STRUCTURAL[preset] ?? [DEFAULT_RING];
  return {
    parts: parts.map((geometry, index) => ({ id: `${preset}-${geometry.layer}-${index}`, geometry })),
  };
}

export const AVATAR_FRAME_DEFINITIONS = Object.fromEntries(
  AVATAR_FRAME_PRESETS.map((preset) => [preset, defaultDefinition(preset)]),
) as Record<AvatarFramePreset, AvatarFrameDefinition>;

export const AVATAR_STAGE_LAYER_ORDER: readonly AvatarStageLayer[] = [
  "inner-ring",
  "outer-ring",
  "top-ornament",
  "side-ornament",
  "orbit",
  "foreground",
];
