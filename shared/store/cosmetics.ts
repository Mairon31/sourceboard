export const AVATAR_FRAME_PRESETS = [
  "nebula",
  "stellar",
  "emerald",
  "rainbow",
  "eclipse",
  "ocean",
  "nova",
  "cyber",
  "gold",
  "shadow",
  "sakura",
  "inferno",
  "crystal",
] as const;

export type AvatarFramePreset = (typeof AVATAR_FRAME_PRESETS)[number];

export const PROFILE_EFFECT_PRESETS = [
  "none",
  "soft-glow",
  "paper-grain",
  "star-dust",
  "blue-energy",
  "fire-pulse",
  "pink-hearts",
  "dark-smoke",
  "snow-drift",
  "electric-burst",
  "holy-glow",
  "butterfly",
  "rgb-glitch",
  "moon-mist",
  "leaf-drift",
] as const;

export type ProfileEffectPreset = (typeof PROFILE_EFFECT_PRESETS)[number];

export const NAME_EFFECT_PRESETS = [
  "red",
  "blue",
  "green",
  "purple",
  "gold",
  "rainbow",
  "cyber",
  "inferno",
  "ice",
  "aurora",
] as const;

export type NameEffectPreset = (typeof NAME_EFFECT_PRESETS)[number];

export const NAME_FONT_FAMILIES = [
  "InterVariable",
  "AtkinsonHyperlegible",
  "Georgia",
  "Trebuchet MS",
  "Courier New",
  "Verdana",
  "Times New Roman",
  "Arial Black",
  "system-ui",
  "monospace",
] as const;

export type NameFontFamily = (typeof NAME_FONT_FAMILIES)[number];

export function isAvatarFramePreset(value: unknown): value is AvatarFramePreset {
  return AVATAR_FRAME_PRESETS.includes(value as AvatarFramePreset);
}

export function isProfileEffectPreset(value: unknown): value is ProfileEffectPreset {
  return PROFILE_EFFECT_PRESETS.includes(value as ProfileEffectPreset);
}

export function isNameEffectPreset(value: unknown): value is NameEffectPreset {
  return NAME_EFFECT_PRESETS.includes(value as NameEffectPreset);
}

export function isNameFontFamily(value: unknown): value is NameFontFamily {
  return NAME_FONT_FAMILIES.includes(value as NameFontFamily);
}
