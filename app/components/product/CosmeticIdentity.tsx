import type { CSSProperties } from "react";
import type {
  AvatarFramePreset,
  NameEffectPreset,
  NameFontFamily,
} from "../../../shared/store/cosmetics";
import type { CosmeticIdentityVisuals } from "../../../shared/store/custom-cosmetics";
import { Avatar } from "../ui";
import { cosmeticVisualClass, cosmeticVisualStyle, mergeCosmeticVisuals } from "./cosmetic-visual";

export interface CosmeticIdentityProps {
  displayName: string;
  avatarUrl?: string;
  avatarFrame?: AvatarFramePreset;
  nameFont?: NameFontFamily;
  nameEffect?: NameEffectPreset;
  visuals?: CosmeticIdentityVisuals;
  mode: "profile" | "compact" | "preview";
  avatarSize?: "sm" | "md" | "lg" | "xl";
  nameAs?: "span" | "strong" | "h1";
}

export function CosmeticIdentity({
  displayName,
  avatarUrl,
  avatarFrame,
  nameFont,
  nameEffect,
  visuals,
  mode,
  avatarSize = mode === "profile" ? "xl" : mode === "preview" ? "lg" : "sm",
  nameAs = "span",
}: CosmeticIdentityProps) {
  const NameTag = nameAs;
  const nameVisual = mergeCosmeticVisuals(visuals?.nameFont, visuals?.nameEffect);
  const nameStyle: CSSProperties = {
    ...(nameFont ? { fontFamily: nameFont } : {}),
    ...(cosmeticVisualStyle(nameVisual) ?? {}),
  };
  const decorativeFrame = avatarFrame === "cat-ears" || avatarFrame === "wings";

  return (
    <div className={`cosmetic-identity cosmetic-identity--${mode}`}>
      <span
        className={`cosmetic-identity__avatar-shell profile-avatar-area${decorativeFrame ? " product-avatar-frame--decorative" : ""}${cosmeticVisualClass(visuals?.avatarFrame)}`}
        style={cosmeticVisualStyle(visuals?.avatarFrame)}
        data-avatar-frame={avatarFrame}
      >
        <Avatar
          name={displayName}
          src={avatarUrl}
          size={avatarSize}
          className={avatarFrame ? `sb-avatar--frame-${avatarFrame}` : undefined}
        />
      </span>
      <NameTag
        className={`cosmetic-identity__name profile-name-area${nameEffect ? ` sb-name-effect--${nameEffect}` : ""}${cosmeticVisualClass(nameVisual)}`}
        style={nameStyle}
      >
        {displayName}
      </NameTag>
    </div>
  );
}
