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
import "./profile-effects.css";
import "./profile-themes.css";
import "./platform-overhaul-cosmetics.css";

export interface ProfileIdentityCardProps {
  children: ReactNode;
  className?: string;
  profileTheme?: ProfileThemePreset;
  legacyProfileBanner?: ProfileBannerPreset;
  profileEffect?: ProfileEffectPreset;
  bannerUrl?: string;
  visuals?: CosmeticIdentityVisuals;
  communityStyles?: Array<{ id: string; css: string }>;
  mode?: "profile" | "compact" | "preview" | "store" | "admin";
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
  mode = "profile",
}: ProfileIdentityCardProps) {
  const theme = profileTheme ?? legacyProfileBanner;

  return (
    <Card
      className={`product-profile-hero product-profile-identity-card cosmetic-root${className ? ` ${className}` : ""}`}
      data-profile-theme={theme ?? "default"}
      data-cosmetic-context={mode}
      data-community-cosmetic={communityStyles?.map((style) => style.id).join(" ") || undefined}
    >
      {communityStyles?.map((communityStyle) => (
        <style key={communityStyle.id}>{communityStyle.css}</style>
      ))}
      <ProfileThemeLayer preset={theme} visual={visuals?.profileBanner} />
      <div className="product-profile-cover" aria-hidden="true">
        {bannerUrl ? (
          <div
            className="product-profile-theme-photo"
            style={{ backgroundImage: `url("${bannerUrl}")` }}
          />
        ) : null}
      </div>
      <ProfileEffectLayer preset={profileEffect} visual={visuals?.profileEffect} />
      <div className="product-profile-card-surface profile-card">{children}</div>
    </Card>
  );
}
