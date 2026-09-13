import {
  parseCosmeticVisualConfig,
  type CosmeticVisualConfigV1,
} from "./cosmetic-config";

const CREATOR_PRO_KEYS = [
  "schemaVersion",
  "palette",
  "gradient",
  "animation",
  "glow",
  "opacity",
  "blendMode",
  "particles",
  "intensity",
] as const;

export function parseCreatorProStoreConfig(input: unknown): CosmeticVisualConfigV1 | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (value.schemaVersion === undefined) return null;

  const visual: Record<string, unknown> = {};
  for (const key of CREATOR_PRO_KEYS) {
    if (value[key] !== undefined) visual[key] = value[key];
  }
  return parseCosmeticVisualConfig(visual);
}

export function mergeCreatorProStoreConfig(
  base: Record<string, unknown>,
  visual: CosmeticVisualConfigV1,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const key of CREATOR_PRO_KEYS) delete merged[key];
  return { ...merged, ...parseCosmeticVisualConfig(visual) };
}
