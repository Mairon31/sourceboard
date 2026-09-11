import type { ProfileBannerPreset, ProfileThemePreset } from "../../../shared/store/cosmetics";
import type { CosmeticVisualDefinition } from "../../../shared/store/custom-cosmetics";
import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";

export interface ProfileThemeLayerProps {
  preset?: ProfileThemePreset;
  legacyPreset?: ProfileBannerPreset;
  visual?: CosmeticVisualDefinition;
  bannerUrl?: string;
}

export function ProfileThemeLayer({
  preset,
  legacyPreset,
  visual,
  bannerUrl,
}: ProfileThemeLayerProps) {
  const theme = preset ?? legacyPreset ?? "default";

  return (
    <div className="product-profile-cover" aria-hidden="true" data-profile-theme={theme}>
      <div
        className={`product-profile-theme-layer${cosmeticVisualClass(visual)}`}
        style={cosmeticVisualStyle(visual)}
      />
      {bannerUrl ? (
        <div
          className="product-profile-theme-photo"
          style={{ backgroundImage: `url("${bannerUrl}")` }}
        />
      ) : null}
    </div>
  );
}
