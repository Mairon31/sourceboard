import type { ProfileThemePreset } from "../../../shared/store/cosmetics";
import type { CosmeticVisualConfigV1 } from "../../../shared/store/cosmetic-config";
import type { CosmeticVisualDefinition } from "../../../shared/store/custom-cosmetics";
import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";
import { creatorProVisualStyle } from "./creator-pro-visual";

export interface ProfileThemeLayerProps {
  preset?: ProfileThemePreset;
  visual?: CosmeticVisualDefinition;
  creatorPro?: CosmeticVisualConfigV1;
}

export function ProfileThemeLayer({ preset, visual, creatorPro }: ProfileThemeLayerProps) {
  return (
    <div
      className={`product-profile-theme-layer${cosmeticVisualClass(visual)}`}
      data-profile-theme={preset ?? "default"}
      data-creator-pro={creatorPro ? "true" : undefined}
      style={{ ...(cosmeticVisualStyle(visual) ?? {}), ...(creatorProVisualStyle(creatorPro, "theme") ?? {}) }}
      aria-hidden="true"
    />
  );
}
