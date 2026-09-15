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
  nebula: [
    { layer: "outer-ring", anchor: "center", scale: 1.08, offsetX: 0, offsetY: 0, rotation: 0, animationDurationMs: 7200, intensity: 0.74 },
    { layer: "orbit", anchor: "center", scale: 1.18, offsetX: 0, offsetY: 0, rotation: 18, animationDurationMs: 9000, intensity: 0.6 },
  ],
  stellar: [
    { layer: "inner-ring", anchor: "center", scale: 0.98, offsetX: 0, offsetY: 0, rotation: 0 },
    { layer: "foreground", anchor: "center", scale: 1.1, offsetX: 0, offsetY: 0, rotation: 8, animationDurationMs: 5200, intensity: 0.7 },
  ],
  emerald: [
    { layer: "outer-ring", anchor: "center", scale: 1.06, offsetX: 0, offsetY: 0, rotation: 0, intensity: 0.7 },
  ],
  rainbow: [
    { layer: "outer-ring", anchor: "center", scale: 1.08, offsetX: 0, offsetY: 0, rotation: 0, intensity: 0.82 },
    { layer: "orbit", anchor: "center", scale: 1.15, offsetX: 0, offsetY: 0, rotation: 20, animationDurationMs: 6400, intensity: 0.72 },
  ],
  eclipse: [
    { layer: "outer-ring", anchor: "center", scale: 1.1, offsetX: 0, offsetY: 0, rotation: -22, intensity: 0.9 },
    { layer: "orbit", anchor: "center", scale: 1.04, offsetX: 0, offsetY: 0, rotation: 45, animationDurationMs: 10000, intensity: 0.42 },
  ],
  ocean: [
    { layer: "inner-ring", anchor: "center", scale: 1, offsetX: 0, offsetY: 0, rotation: 0, intensity: 0.76 },
    { layer: "orbit", anchor: "center", scale: 1.14, offsetX: 0, offsetY: 0, rotation: -12, animationDurationMs: 7600, intensity: 0.55 },
  ],
  nova: [
    { layer: "outer-ring", anchor: "center", scale: 1.15, offsetX: 0, offsetY: 0, rotation: 0, intensity: 0.95 },
    { layer: "foreground", anchor: "center", scale: 1.2, offsetX: 0, offsetY: 0, rotation: 0, animationDurationMs: 3600, intensity: 0.9 },
  ],
  cyber: [
    { layer: "inner-ring", anchor: "center", scale: 1, offsetX: 0, offsetY: 0, rotation: 0, intensity: 0.8 },
    { layer: "orbit", anchor: "center", scale: 1.13, offsetX: 0, offsetY: 0, rotation: 45, animationDurationMs: 4200, intensity: 0.85 },
  ],
  gold: [
    { layer: "outer-ring", anchor: "center", scale: 1.07, offsetX: 0, offsetY: 0, rotation: 0, intensity: 0.88 },
  ],
  shadow: [
    { layer: "outer-ring", anchor: "center", scale: 1.13, offsetX: 0, offsetY: 0, rotation: 0, intensity: 0.72 },
    { layer: "foreground", anchor: "center", scale: 1.05, offsetX: 0, offsetY: 0, rotation: -8, animationDurationMs: 6800, intensity: 0.45 },
  ],
  sakura: [
    { layer: "foreground", anchor: "center", scale: 1.16, offsetX: 0, offsetY: 0, rotation: 0, animationDurationMs: 5600, intensity: 0.78 },
  ],
  inferno: [
    { layer: "outer-ring", anchor: "center", scale: 1.11, offsetX: 0, offsetY: 0, rotation: 0, intensity: 0.9 },
    { layer: "orbit", anchor: "center", scale: 1.17, offsetX: 0, offsetY: 0, rotation: -20, animationDurationMs: 3200, intensity: 0.82 },
  ],
  crystal: [
    { layer: "outer-ring", anchor: "center", scale: 1.08, offsetX: 0, offsetY: 0, rotation: 0, intensity: 0.82 },
    { layer: "top-ornament", anchor: "top", scale: 0.75, offsetX: 0, offsetY: -0.18, rotation: 0, intensity: 0.72 },
  ],
  holographic: [
    { layer: "outer-ring", anchor: "center", scale: 1.09, offsetX: 0, offsetY: 0, rotation: 0, intensity: 0.86 },
    { layer: "orbit", anchor: "center", scale: 1.16, offsetX: 0, offsetY: 0, rotation: 28, animationDurationMs: 4800, intensity: 0.7 },
  ],
  fire: [
    { layer: "outer-ring", anchor: "center", scale: 1.11, offsetX: 0, offsetY: 0, rotation: 0, intensity: 0.9 },
    { layer: "foreground", anchor: "center", scale: 1.15, offsetX: 0, offsetY: 0, rotation: 4, animationDurationMs: 3000, intensity: 0.8 },
  ],
  ice: [
    { layer: "inner-ring", anchor: "center", scale: 0.99, offsetX: 0, offsetY: 0, rotation: 0, intensity: 0.72 },
    { layer: "outer-ring", anchor: "center", scale: 1.09, offsetX: 0, offsetY: 0, rotation: 0, intensity: 0.82 },
  ],
  electric: [
    { layer: "orbit", anchor: "center", scale: 1.12, offsetX: 0, offsetY: 0, rotation: 0, animationDurationMs: 2600, intensity: 0.95 },
    { layer: "orbit", anchor: "center", scale: 1.2, offsetX: 0, offsetY: 0, rotation: 90, animationDurationMs: 4100, intensity: 0.68 },
  ],
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
  "simple-blue": [
    { layer: "inner-ring", anchor: "center", scale: 1.02, offsetX: 0, offsetY: 0, rotation: 0 },
  ],
  cyan: [
    { layer: "inner-ring", anchor: "center", scale: 1.02, offsetX: 0, offsetY: 0, rotation: 0 },
  ],
  purple: [
    { layer: "inner-ring", anchor: "center", scale: 1.04, offsetX: 0, offsetY: 0, rotation: 0 },
  ],
  pink: [
    { layer: "inner-ring", anchor: "center", scale: 1.04, offsetX: 0, offsetY: 0, rotation: 0 },
  ],
  green: [
    { layer: "inner-ring", anchor: "center", scale: 1.02, offsetX: 0, offsetY: 0, rotation: 0 },
  ],
  red: [
    { layer: "inner-ring", anchor: "center", scale: 1.02, offsetX: 0, offsetY: 0, rotation: 0 },
  ],
  white: [
    { layer: "inner-ring", anchor: "center", scale: 0.99, offsetX: 0, offsetY: 0, rotation: 0 },
  ],
  dark: [
    { layer: "outer-ring", anchor: "center", scale: 1.04, offsetX: 0, offsetY: 0, rotation: 0 },
  ],
  pastel: [
    { layer: "outer-ring", anchor: "center", scale: 1.06, offsetX: 0, offsetY: 0, rotation: 0 },
  ],
  "double-blue": [
    { layer: "inner-ring", anchor: "center", scale: 1, offsetX: 0, offsetY: 0, rotation: 0 },
    { layer: "outer-ring", anchor: "center", scale: 1.08, offsetX: 0, offsetY: 0, rotation: 0 },
  ],
  "thin-neon": [
    { layer: "outer-ring", anchor: "center", scale: 1.05, offsetX: 0, offsetY: 0, rotation: 0, animationDurationMs: 6200 },
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
