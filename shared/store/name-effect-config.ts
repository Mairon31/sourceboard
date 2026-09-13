import type { NameEffectPreset } from "./cosmetics";

export type NameMotion =
  | "none"
  | "sequential-bounce"
  | "bounce"
  | "wave"
  | "pulse"
  | "float"
  | "soft-shake"
  | "shimmer"
  | "breathe";
export type NameLight =
  | "none"
  | "gradient-travel"
  | "neon"
  | "sparkle-sweep"
  | "chroma"
  | "metallic"
  | "flicker"
  | "plasma"
  | "outline-glow";
export type NameAccent =
  | "none"
  | "sparkles"
  | "underline"
  | "trail"
  | "glitch-fragments"
  | "highlight-pass";

export interface NameEffectDefinition {
  motion: NameMotion;
  light: NameLight;
  accent: NameAccent;
  durationMs: number;
  delayMs: number;
  intensity: number;
  direction: "normal" | "reverse" | "alternate";
  colors: string[];
}

const DEFAULT: NameEffectDefinition = {
  motion: "none",
  light: "gradient-travel",
  accent: "none",
  durationMs: 3600,
  delayMs: 0,
  intensity: 0.65,
  direction: "normal",
  colors: ["#7c8cff", "#62e8ff", "#f28cff"],
};

const SPECIAL: Partial<Record<NameEffectPreset, NameEffectDefinition>> = {
  "sequential-bounce": { ...DEFAULT, motion: "sequential-bounce", light: "none", durationMs: 1800 },
  "bounce-neon": { ...DEFAULT, motion: "bounce", light: "neon", durationMs: 2200 },
  "wave-gradient": { ...DEFAULT, motion: "wave", light: "gradient-travel", durationMs: 3200 },
  "sparkle-sweep": { ...DEFAULT, motion: "shimmer", light: "sparkle-sweep", accent: "sparkles", durationMs: 3600 },
  "soft-flicker": { ...DEFAULT, motion: "none", light: "flicker", durationMs: 4200, intensity: 0.35 },
  "metallic-shine": { ...DEFAULT, motion: "shimmer", light: "metallic", accent: "highlight-pass", durationMs: 4800 },
  plasma: { ...DEFAULT, motion: "breathe", light: "plasma", durationMs: 4000 },
  chroma: { ...DEFAULT, motion: "float", light: "chroma", durationMs: 5000 },
  "light-trail": { ...DEFAULT, motion: "wave", light: "outline-glow", accent: "trail", durationMs: 3000 },
};

export function nameEffectDefinition(preset: NameEffectPreset): NameEffectDefinition {
  return SPECIAL[preset] ?? DEFAULT;
}

export function validateNameEffectDefinition(value: NameEffectDefinition): boolean {
  return (
    Number.isFinite(value.durationMs) &&
    value.durationMs >= 800 &&
    value.durationMs <= 20_000 &&
    Number.isFinite(value.delayMs) &&
    value.delayMs >= 0 &&
    value.delayMs <= 10_000 &&
    Number.isFinite(value.intensity) &&
    value.intensity >= 0 &&
    value.intensity <= 1 &&
    value.colors.length >= 1 &&
    value.colors.length <= 8
  );
}
