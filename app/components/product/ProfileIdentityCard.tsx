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
  communityStyles?: Array<{ id: string; css: string }>;
}

export function ProfileIdentityCard({
  children,
  className,
  profileTheme,
  legacyProfileBanner,
  profileEffect,
  bannerUrl,
  visuals,
  communityStyles,
}: ProfileIdentityCardProps) {
  const theme = profileTheme ?? legacyProfileBanner;
  const themeVisual = visuals?.profileBanner;
  const effectVisual = visuals?.profileEffect;
  const hasEffect = Boolean((profileEffect && profileEffect !== "none") || effectVisual);

  return (
    <Card
      className={`product-profile-hero product-profile-identity-card cosmetic-root${className ? ` ${className}` : ""}`}
      data-profile-theme={theme ?? "default"}
      data-community-cosmetic={communityStyles?.map((style) => style.id).join(" ") || undefined}
    >
      {communityStyles?.map((communityStyle) => (
        <style key={communityStyle.id}>{communityStyle.css}</style>
      ))}
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
      <div className="product-profile-card-surface profile-card">{children}</div>
    </Card>
  );
}
