import {
  isAvatarFramePreset,
  isProfileEffectPreset,
  isProfileThemePreset,
  type AvatarFramePreset,
  type ProfileEffectPreset,
  type ProfileThemePreset,
} from "../../../shared/store/cosmetics";
import type {
  CosmeticIdentityVisuals,
  CosmeticVisualDefinition,
} from "../../../shared/store/custom-cosmetics";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { ProfileIdentityCard } from "./ProfileIdentityCard";

export type ProfileCosmeticPreviewType = "PROFILE_BANNER" | "PROFILE_EFFECT" | "AVATAR_FRAME";

export interface ProfileCosmeticPreviewProps {
  type: ProfileCosmeticPreviewType;
  preset?: string;
  name: string;
  avatarUrl?: string;
  visual?: CosmeticVisualDefinition;
  communityStyles?: Array<{ id: string; css: string }>;
  bannerUrl?: string;
  className?: string;
}

function previewVisuals(
  type: ProfileCosmeticPreviewType,
  visual?: CosmeticVisualDefinition,
): CosmeticIdentityVisuals | undefined {
  if (!visual) return undefined;
  if (type === "PROFILE_BANNER") return { profileBanner: visual };
  if (type === "PROFILE_EFFECT") return { profileEffect: visual };
  return { avatarFrame: visual };
}

function validTheme(
  type: ProfileCosmeticPreviewType,
  preset?: string,
): ProfileThemePreset | undefined {
  return type === "PROFILE_BANNER" && isProfileThemePreset(preset) ? preset : undefined;
}

function validEffect(
  type: ProfileCosmeticPreviewType,
  preset?: string,
): ProfileEffectPreset | undefined {
  return type === "PROFILE_EFFECT" && isProfileEffectPreset(preset) ? preset : undefined;
}

function validFrame(
  type: ProfileCosmeticPreviewType,
  preset?: string,
): AvatarFramePreset | undefined {
  return type === "AVATAR_FRAME" && isAvatarFramePreset(preset) ? preset : undefined;
}

export function ProfileCosmeticPreview({
  type,
  preset,
  name,
  avatarUrl,
  visual,
  communityStyles,
  bannerUrl,
  className,
}: ProfileCosmeticPreviewProps) {
  const visuals = previewVisuals(type, visual);
  const frame = validFrame(type, preset);

  if (type === "AVATAR_FRAME") {
    return (
      <div
        className={`product-cosmetic-preview product-cosmetic-preview--frame cosmetic-root${className ? ` ${className}` : ""}`}
      >
        {communityStyles?.map((style) => (
          <style key={style.id}>{style.css}</style>
        ))}
        <div className="profile-card product-cosmetic-preview__frame-surface">
          <CosmeticIdentity
            displayName={name}
            avatarUrl={avatarUrl}
            avatarFrame={frame}
            visuals={visuals}
            mode="preview"
            nameAs="strong"
          />
        </div>
      </div>
    );
  }

  return (
    <ProfileIdentityCard
      className={`product-cosmetic-preview product-cosmetic-preview--card${className ? ` ${className}` : ""}`}
      profileTheme={validTheme(type, preset)}
      profileEffect={validEffect(type, preset)}
      bannerUrl={bannerUrl}
      visuals={visuals}
      communityStyles={communityStyles}
    >
      <div className="profile-header product-cosmetic-preview__header">
        <CosmeticIdentity displayName={name} avatarUrl={avatarUrl} mode="preview" nameAs="strong" />
      </div>
    </ProfileIdentityCard>
  );
}
