import type { ProfileThemePreset } from "../../../shared/store/cosmetics";
import type { CosmeticVisualDefinition } from "../../../shared/store/custom-cosmetics";
import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";

export interface ProfileThemeLayerProps {
  preset?: ProfileThemePreset;
  visual?: CosmeticVisualDefinition;
}

export function ProfileThemeLayer({ preset, visual }: ProfileThemeLayerProps) {
  return (
    <div
      className={`product-profile-theme-layer${cosmeticVisualClass(visual)}`}
      data-profile-theme={preset ?? "default"}
      style={cosmeticVisualStyle(visual)}
      aria-hidden="true"
    />
  );
}
