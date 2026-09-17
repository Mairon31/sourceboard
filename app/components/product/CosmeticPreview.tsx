import type { CosmeticVisualConfigV1 } from "../../../shared/store/cosmetic-config";
import type {
  CosmeticIdentityVisuals,
  CosmeticVisualDefinition,
} from "../../../shared/store/custom-cosmetics";
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
import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";
import "./cosmetic-preview.css";

export type CosmeticPreviewInput =
  | { type: "PROFILE_BANNER"; preset: ProfileThemePreset }
  | { type: "PROFILE_EFFECT"; preset: ProfileEffectPreset }
  | { type: "AVATAR_FRAME"; preset: AvatarFramePreset }
  | { type: "NAME_FONT"; preset: NameFontFamily }
  | { type: "NAME_EFFECT"; preset: NameEffectPreset };

export function CosmeticPreview({
  cosmetic,
  creatorPro,
  compact = false,
  name = "SourceBoard Creator",
  avatarUrl,
  visual,
  communityStyles,
  className,
}: {
  cosmetic: CosmeticPreviewInput;
  creatorPro?: CosmeticVisualConfigV1;
  compact?: boolean;
  name?: string;
  avatarUrl?: string;
  visual?: CosmeticVisualDefinition;
  communityStyles?: Array<{ id: string; css: string }>;
  className?: string;
}) {
  const identityVisuals: CosmeticIdentityVisuals | undefined = visual
    ? cosmetic.type === "NAME_FONT"
      ? { nameFont: visual }
      : cosmetic.type === "NAME_EFFECT"
        ? { nameEffect: visual }
        : undefined
    : undefined;
  const previewClassName = `product-canonical-cosmetic-preview${className ? ` ${className}` : ""}`;
  if (cosmetic.type === "AVATAR_FRAME") {
    return (
      <div
        className={`${previewClassName} cosmetic-root`}
        data-preview-type={cosmetic.type}
        data-community-cosmetic={communityStyles?.map((style) => style.id).join(" ") || undefined}
      >
        {communityStyles?.map((style) => (
          <style key={style.id}>{style.css}</style>
        ))}
        <AvatarStage
          avatarUrl={avatarUrl}
          alt={name}
          frame={cosmetic.preset}
          size="preview"
          className={cosmeticVisualClass(visual).trim() || undefined}
          style={cosmeticVisualStyle(visual)}
          creatorPro={creatorPro}
        />
        <strong>{name}</strong>
      </div>
    );
  }
  if (cosmetic.type === "NAME_FONT" || cosmetic.type === "NAME_EFFECT") {
    const font = cosmetic.type === "NAME_FONT" ? cosmetic.preset : undefined;
    const effect = cosmetic.type === "NAME_EFFECT" ? cosmetic.preset : undefined;
    const creatorProIdentity = creatorPro
      ? cosmetic.type === "NAME_FONT"
        ? { nameFont: creatorPro }
        : { nameEffect: creatorPro }
      : undefined;
    return (
      <div
        className={`${previewClassName} cosmetic-root`}
        data-preview-type={cosmetic.type}
        data-community-cosmetic={communityStyles?.map((style) => style.id).join(" ") || undefined}
      >
        {communityStyles?.map((style) => (
          <style key={style.id}>{style.css}</style>
        ))}
        {font ? <FontResources families={[font]} /> : null}
        <CosmeticIdentity
          displayName={name}
          avatarUrl={avatarUrl}
          nameFont={font}
          nameEffect={effect}
          creatorPro={creatorProIdentity}
          mode="preview"
          nameAs="strong"
          visuals={identityVisuals}
        />
      </div>
    );
  }
  const creatorProCard = creatorPro
    ? cosmetic.type === "PROFILE_BANNER"
      ? { profileBanner: creatorPro }
      : { profileEffect: creatorPro }
    : undefined;
  return (
    <ProfileIdentityCard
      className={`${previewClassName} product-canonical-cosmetic-preview--card`}
      profileTheme={cosmetic.type === "PROFILE_BANNER" ? cosmetic.preset : undefined}
      profileEffect={cosmetic.type === "PROFILE_EFFECT" ? cosmetic.preset : undefined}
      creatorPro={creatorProCard}
      visuals={
        visual
          ? cosmetic.type === "PROFILE_BANNER"
            ? { profileBanner: visual }
            : { profileEffect: visual }
          : undefined
      }
      communityStyles={communityStyles}
      mode={compact ? "compact" : "preview"}
    >
      <CosmeticIdentity displayName={name} avatarUrl={avatarUrl} mode="preview" nameAs="strong" />
    </ProfileIdentityCard>
  );
}
