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
  "holographic",
  "fire",
  "ice",
  "electric",
  "cat-ears",
  "wings",
  "glitch-ring",
  "neko-neon",
  "pixel-glitch",
  "devil-horns",
  "angel-halo",
  "cyber-wings",
  "crown",
  "electric-coils",
  "orbit-planets",
  "sakura-petals",
  "black-hole",
  "slime",
  "retro-arcade",
  "cat-ears-black",
  "cat-ears-white",
  "fox-ears",
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
  "falling-stars",
  "cherry-blossom",
  "neon-rain",
  "matrix-rain",
  "pixel-spark",
  "cosmic-rift",
  "ocean-bubbles",
  "ghost-flames",
  "confetti",
  "love-letter",
  "meteor-shower",
  "digital-scan",
] as const;

export type ProfileEffectPreset = (typeof PROFILE_EFFECT_PRESETS)[number];

export const PROFILE_THEME_PRESETS = [
  "nebula",
  "aurora",
  "ember",
  "ocean-glass",
  "sunset-noir",
  "prism-grid",
  "forest-ink",
  "silver-wave",
  "cosmic-dusk",
  "terminal-grid",
  "sakura-night",
  "golden-hour",
] as const;

export type ProfileThemePreset = (typeof PROFILE_THEME_PRESETS)[number];

// Compatibility alias for persisted PROFILE_BANNER Store rows. New UI and DTOs use Profile Theme.
export const PROFILE_BANNER_PRESETS = PROFILE_THEME_PRESETS;
export type ProfileBannerPreset = ProfileThemePreset;

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
  "hologram",
  "void",
  "solar",
  "candy",
  "terminal",
  "chrome",
] as const;

export type NameEffectPreset = (typeof NAME_EFFECT_PRESETS)[number];

export const NAME_FONT_FAMILIES = [
  "InterVariable",
  "AtkinsonHyperlegible",
  "Manrope",
  "DM Sans",
  "Urbanist",
  "Anton",
  "League Spartan",
  "Fredoka",
  "Playfair Display",
  "Cormorant Garamond",
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

export function isProfileThemePreset(value: unknown): value is ProfileThemePreset {
  return PROFILE_THEME_PRESETS.includes(value as ProfileThemePreset);
}

export function isProfileBannerPreset(value: unknown): value is ProfileBannerPreset {
  return isProfileThemePreset(value);
}

export function isNameEffectPreset(value: unknown): value is NameEffectPreset {
  return NAME_EFFECT_PRESETS.includes(value as NameEffectPreset);
}

export function isNameFontFamily(value: unknown): value is NameFontFamily {
  return NAME_FONT_FAMILIES.includes(value as NameFontFamily);
}
