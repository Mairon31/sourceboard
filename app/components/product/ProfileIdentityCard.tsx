import type { ReactNode } from "react";
import type {
  ProfileBannerPreset,
  ProfileEffectPreset,
  ProfileThemePreset,
} from "../../../shared/store/cosmetics";
import type { CosmeticIdentityVisuals } from "../../../shared/store/custom-cosmetics";
import { Card } from "../ui";
import { ProfileEffectLayer } from "./ProfileEffectLayer";
import { ProfileThemeLayer } from "./ProfileThemeLayer";
import "./profile-identity-card.css";
import "./profile-cover.css";

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

  return (
    <Card
      className={`product-profile-hero product-profile-identity-card cosmetic-root${className ? ` ${className}` : ""}`}
      data-profile-theme={theme ?? "default"}
      data-community-cosmetic={communityStyles?.map((style) => style.id).join(" ") || undefined}
    >
      {communityStyles?.map((communityStyle) => (
        <style key={communityStyle.id}>{communityStyle.css}</style>
      ))}
      <ProfileThemeLayer
        preset={profileTheme}
        legacyPreset={legacyProfileBanner}
        visual={visuals?.profileBanner}
        bannerUrl={bannerUrl}
      />
      <ProfileEffectLayer preset={profileEffect} visual={visuals?.profileEffect} />
      <div className="product-profile-card-surface profile-card">{children}</div>
    </Card>
  );
}
