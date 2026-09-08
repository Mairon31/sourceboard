export const COSMETIC_VISUAL_NAMESPACE = "sourceboard.cosmetic.v1" as const;

export const COSMETIC_VISUAL_KEYS = [
  "foregroundColor",
  "backgroundColor",
  "borderColor",
  "glowColor",
  "borderWidth",
  "borderRadius",
  "glowSize",
  "opacity",
  "fontWeight",
  "letterSpacing",
  "fontStyle",
  "textTransform",
  "animation",
  "animationDurationMs",
] as const;

export type CosmeticVisualKey = (typeof COSMETIC_VISUAL_KEYS)[number];
export type CosmeticVisualAnimation = "none" | "pulse" | "shimmer" | "float" | "spin";
export type CosmeticVisualTextTransform = "none" | "uppercase" | "lowercase";
export type CosmeticVisualFontStyle = "normal" | "italic";

export interface CosmeticVisualDefinition {
  foregroundColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  glowColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  glowSize?: number;
  opacity?: number;
  fontWeight?: number;
  letterSpacing?: number;
  fontStyle?: CosmeticVisualFontStyle;
  textTransform?: CosmeticVisualTextTransform;
  animation?: CosmeticVisualAnimation;
  animationDurationMs?: number;
}

export interface CosmeticIdentityVisuals {
  avatarFrame?: CosmeticVisualDefinition;
  profileBanner?: CosmeticVisualDefinition;
  profileEffect?: CosmeticVisualDefinition;
  nameFont?: CosmeticVisualDefinition;
  nameEffect?: CosmeticVisualDefinition;
}

export interface CosmeticVisualConfig {
  namespace: typeof COSMETIC_VISUAL_NAMESPACE;
  visual: CosmeticVisualDefinition;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
const ANIMATIONS = new Set<CosmeticVisualAnimation>(["none", "pulse", "shimmer", "float", "spin"]);
const TEXT_TRANSFORMS = new Set<CosmeticVisualTextTransform>(["none", "uppercase", "lowercase"]);
const FONT_STYLES = new Set<CosmeticVisualFontStyle>(["normal", "italic"]);
const CONFIG_KEYS = new Set(["namespace", "visual", "preset", "family"]);

function finiteNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    return undefined;
  return value;
}

function safeColor(value: unknown): string | undefined {
  return typeof value === "string" && HEX_COLOR.test(value) ? value.toLowerCase() : undefined;
}

export function normalizeCosmeticVisualDefinition(value: unknown): CosmeticVisualDefinition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !COSMETIC_VISUAL_KEYS.includes(key as CosmeticVisualKey)))
    return null;

  const visual: CosmeticVisualDefinition = {};
  const colors: Array<
    keyof Pick<
      CosmeticVisualDefinition,
      "foregroundColor" | "backgroundColor" | "borderColor" | "glowColor"
    >
  > = ["foregroundColor", "backgroundColor", "borderColor", "glowColor"];
  for (const key of colors) {
    if (input[key] === undefined) continue;
    const color = safeColor(input[key]);
    if (!color) return null;
    visual[key] = color;
  }

  const bounded: Array<
    [
      keyof Pick<
        CosmeticVisualDefinition,
        | "borderWidth"
        | "borderRadius"
        | "glowSize"
        | "opacity"
        | "fontWeight"
        | "letterSpacing"
        | "animationDurationMs"
      >,
      number,
      number,
    ]
  > = [
    ["borderWidth", 0, 8],
    ["borderRadius", 0, 999],
    ["glowSize", 0, 48],
    ["opacity", 0.2, 1],
    ["fontWeight", 300, 900],
    ["letterSpacing", -1, 6],
    ["animationDurationMs", 400, 12000],
  ];
  for (const [key, min, max] of bounded) {
    if (input[key] === undefined) continue;
    const number = finiteNumber(input[key], min, max);
    if (number === undefined) return null;
    visual[key] = number;
  }

  if (input.fontStyle !== undefined) {
    if (
      typeof input.fontStyle !== "string" ||
      !FONT_STYLES.has(input.fontStyle as CosmeticVisualFontStyle)
    )
      return null;
    visual.fontStyle = input.fontStyle as CosmeticVisualFontStyle;
  }
  if (input.textTransform !== undefined) {
    if (
      typeof input.textTransform !== "string" ||
      !TEXT_TRANSFORMS.has(input.textTransform as CosmeticVisualTextTransform)
    )
      return null;
    visual.textTransform = input.textTransform as CosmeticVisualTextTransform;
  }
  if (input.animation !== undefined) {
    if (
      typeof input.animation !== "string" ||
      !ANIMATIONS.has(input.animation as CosmeticVisualAnimation)
    )
      return null;
    visual.animation = input.animation as CosmeticVisualAnimation;
  }

  if (!Object.keys(visual).length) return null;
  return visual;
}

export function normalizeCosmeticVisualConfig(value: unknown): CosmeticVisualConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !CONFIG_KEYS.has(key))) return null;
  if (input.namespace !== COSMETIC_VISUAL_NAMESPACE) return null;
  const visual = normalizeCosmeticVisualDefinition(input.visual);
  return visual ? { namespace: COSMETIC_VISUAL_NAMESPACE, visual } : null;
}

export function extractCosmeticVisualDefinition(
  value: unknown,
): CosmeticVisualDefinition | undefined {
  return normalizeCosmeticVisualConfig(value)?.visual;
}

export function isCosmeticVisualDefinition(value: unknown): value is CosmeticVisualDefinition {
  return normalizeCosmeticVisualDefinition(value) !== null;
}
