import type { ReactNode } from "react";
import type {
  ProfileBannerPreset,
  ProfileEffectPreset,
  ProfileThemePreset,
} from "../../../shared/store/cosmetics";
import type { CosmeticIdentityVisuals } from "../../../shared/store/custom-cosmetics";
import { Card } from "../ui";
import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";
import "./profile-identity-card.css";

export interface ProfileIdentityCardProps {
  children: ReactNode;
  className?: string;
  profileTheme?: ProfileThemePreset;
  legacyProfileBanner?: ProfileBannerPreset;
  profileEffect?: ProfileEffectPreset;
  bannerUrl?: string;
  visuals?: CosmeticIdentityVisuals;
}

export function ProfileIdentityCard({
  children,
  className,
  profileTheme,
  legacyProfileBanner,
  profileEffect,
  bannerUrl,
  visuals,
}: ProfileIdentityCardProps) {
  const theme = profileTheme ?? legacyProfileBanner;
  const themeVisual = visuals?.profileBanner;
  const effectVisual = visuals?.profileEffect;
  const hasEffect = Boolean((profileEffect && profileEffect !== "none") || effectVisual);

  return (
    <Card
      className={`product-profile-hero product-profile-identity-card${className ? ` ${className}` : ""}`}
      data-profile-theme={theme ?? "default"}
    >
      <div
        className={`product-profile-theme-layer${cosmeticVisualClass(themeVisual)}`}
        style={cosmeticVisualStyle(themeVisual)}
        aria-hidden="true"
      />
      {bannerUrl ? (
        <div
          className="product-profile-theme-photo"
          style={{ backgroundImage: `url("${bannerUrl}")` }}
          aria-hidden="true"
        />
      ) : null}
      {hasEffect ? (
        <div
          className={`product-profile-effect-layer${profileEffect && profileEffect !== "none" ? ` product-profile-effect-layer--${profileEffect}` : ""}${cosmeticVisualClass(effectVisual)}`}
          style={cosmeticVisualStyle(effectVisual)}
          aria-hidden="true"
        />
      ) : null}
      <div className="product-profile-card-surface">{children}</div>
    </Card>
  );
}
