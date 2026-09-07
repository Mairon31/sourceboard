import type {
  AvatarFramePreset,
  NameFontFamily,
  ProfileEffectPreset,
} from "../../../shared/store/cosmetics";
import { Avatar } from "../ui";

export interface CosmeticIdentityProps {
  displayName: string;
  avatarUrl?: string;
  avatarFrame?: AvatarFramePreset;
  profileEffect?: ProfileEffectPreset;
  nameFont?: NameFontFamily;
  mode: "profile" | "compact" | "preview";
  avatarSize?: "sm" | "md" | "lg" | "xl";
  nameAs?: "span" | "strong" | "h1";
}

export function CosmeticIdentity({
  displayName,
  avatarUrl,
  avatarFrame,
  profileEffect,
  nameFont,
  mode,
  avatarSize = mode === "profile" ? "xl" : mode === "preview" ? "lg" : "sm",
  nameAs = "span",
}: CosmeticIdentityProps) {
  const NameTag = nameAs;
  const effectClass =
    profileEffect && profileEffect !== "none"
      ? ` cosmetic-identity--effect-${profileEffect}`
      : "";

  return (
    <div className={`cosmetic-identity cosmetic-identity--${mode}${effectClass}`}>
      <span className="cosmetic-identity__avatar-shell">
        <Avatar
          name={displayName}
          src={avatarUrl}
          size={avatarSize}
          className={avatarFrame ? `sb-avatar--frame-${avatarFrame}` : undefined}
        />
      </span>
      <NameTag
        className="cosmetic-identity__name"
        style={nameFont ? { fontFamily: nameFont } : undefined}
      >
        {displayName}
      </NameTag>
    </div>
  );
}
