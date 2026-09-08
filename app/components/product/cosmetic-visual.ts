import type { CSSProperties } from "react";
import type { CosmeticVisualDefinition } from "../../../shared/store/custom-cosmetics";

export function mergeCosmeticVisuals(
  first?: CosmeticVisualDefinition,
  second?: CosmeticVisualDefinition,
): CosmeticVisualDefinition | undefined {
  if (!first) return second;
  if (!second) return first;
  return { ...first, ...second };
}

export function cosmeticVisualStyle(
  visual?: CosmeticVisualDefinition,
): CSSProperties | undefined {
  if (!visual) return undefined;
  return {
    "--sb-cosmetic-fg": visual.foregroundColor,
    "--sb-cosmetic-bg": visual.backgroundColor,
    "--sb-cosmetic-border": visual.borderColor,
    "--sb-cosmetic-glow": visual.glowColor,
    "--sb-cosmetic-border-width":
      visual.borderWidth === undefined ? undefined : `${visual.borderWidth}px`,
    "--sb-cosmetic-radius":
      visual.borderRadius === undefined ? undefined : `${visual.borderRadius}px`,
    "--sb-cosmetic-glow-size":
      visual.glowSize === undefined ? undefined : `${visual.glowSize}px`,
    "--sb-cosmetic-opacity": visual.opacity,
    "--sb-cosmetic-font-weight": visual.fontWeight,
    "--sb-cosmetic-letter-spacing":
      visual.letterSpacing === undefined ? undefined : `${visual.letterSpacing}px`,
    "--sb-cosmetic-font-style": visual.fontStyle,
    "--sb-cosmetic-text-transform": visual.textTransform,
    "--sb-cosmetic-duration":
      visual.animationDurationMs === undefined ? undefined : `${visual.animationDurationMs}ms`,
  } as CSSProperties;
}

export function cosmeticVisualClass(visual?: CosmeticVisualDefinition): string {
  if (!visual) return "";
  return ` sb-custom-cosmetic sb-custom-cosmetic--${visual.animation ?? "none"}`;
}
