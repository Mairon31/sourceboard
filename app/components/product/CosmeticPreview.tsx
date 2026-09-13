import type {
  AvatarFramePreset,
  NameEffectPreset,
  NameFontFamily,
  ProfileEffectPreset,
  ProfileThemePreset,
} from "../../../shared/store/cosmetics";
import { AvatarStage } from "./AvatarStage";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { FontResources } from "./FontResources";
import { ProfileIdentityCard } from "./ProfileIdentityCard";
import "./cosmetic-preview.css";

export type CosmeticPreviewInput =
  | { type: "PROFILE_BANNER"; preset: ProfileThemePreset }
  | { type: "PROFILE_EFFECT"; preset: ProfileEffectPreset }
  | { type: "AVATAR_FRAME"; preset: AvatarFramePreset }
  | { type: "NAME_FONT"; preset: NameFontFamily }
  | { type: "NAME_EFFECT"; preset: NameEffectPreset };

export function CosmeticPreview({
  cosmetic,
  compact = false,
  name = "SourceBoard Creator",
  avatarUrl,
}: {
  cosmetic: CosmeticPreviewInput;
  compact?: boolean;
  name?: string;
  avatarUrl?: string;
}) {
  if (cosmetic.type === "AVATAR_FRAME") {
    return (
      <div className="product-canonical-cosmetic-preview" data-preview-type={cosmetic.type}>
        <AvatarStage avatarUrl={avatarUrl} alt={name} frame={cosmetic.preset} size="preview" />
        <strong>{name}</strong>
      </div>
    );
  }
  if (cosmetic.type === "NAME_FONT" || cosmetic.type === "NAME_EFFECT") {
    const font = cosmetic.type === "NAME_FONT" ? cosmetic.preset : undefined;
    const effect = cosmetic.type === "NAME_EFFECT" ? cosmetic.preset : undefined;
    return (
      <div className="product-canonical-cosmetic-preview" data-preview-type={cosmetic.type}>
        {font ? <FontResources families={[font]} /> : null}
        <CosmeticIdentity
          displayName={name}
          avatarUrl={avatarUrl}
          nameFont={font}
          nameEffect={effect}
          mode="preview"
          nameAs="strong"
        />
      </div>
    );
  }
  return (
    <ProfileIdentityCard
      className="product-canonical-cosmetic-preview product-canonical-cosmetic-preview--card"
      profileTheme={cosmetic.type === "PROFILE_BANNER" ? cosmetic.preset : undefined}
      profileEffect={cosmetic.type === "PROFILE_EFFECT" ? cosmetic.preset : undefined}
      mode={compact ? "compact" : "preview"}
    >
      <CosmeticIdentity displayName={name} avatarUrl={avatarUrl} mode="preview" nameAs="strong" />
    </ProfileIdentityCard>
  );
}
