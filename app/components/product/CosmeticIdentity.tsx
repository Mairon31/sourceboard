import type { CSSProperties } from "react";
import type {
  AvatarFramePreset,
  NameEffectPreset,
  NameFontFamily,
} from "../../../shared/store/cosmetics";
import type { CosmeticIdentityVisuals } from "../../../shared/store/custom-cosmetics";
import { Avatar } from "../ui";
import { AnonymousAvatar } from "./AnonymousAvatar";
import {
  cosmeticVisualClass,
  cosmeticVisualStyle,
  mergeCosmeticVisuals,
} from "./cosmetic-visual";
import "./avatar-frames.css";

const STRUCTURAL_AVATAR_FRAMES = new Set<AvatarFramePreset>([
  "cat-ears",
  "wings",
  "glitch-ring",
  "neko-neon",
  "pixel-glitch",
  "devil-horns",
  "angel-halo",
  "cyber-wings",
  "crown",
  "electric-coils",
  "orbit-planets",
  "sakura-petals",
  "black-hole",
  "slime",
  "retro-arcade",
  "cat-ears-black",
  "cat-ears-white",
  "fox-ears",
]);

interface CosmeticIdentityBaseProps {
  mode: "profile" | "compact" | "preview";
  nameAs?: "span" | "strong" | "h1";
}

interface AnonymousCosmeticIdentityProps extends CosmeticIdentityBaseProps {
  anonymous: true;
  displayName?: never;
  avatarUrl?: never;
  avatarFrame?: never;
  nameFont?: never;
  nameEffect?: never;
  visuals?: never;
  avatarSize?: "sm" | "md" | "lg";
}

interface IdentifiedCosmeticIdentityProps extends CosmeticIdentityBaseProps {
  anonymous?: false;
  displayName: string;
  avatarUrl?: string;
  avatarFrame?: AvatarFramePreset;
  nameFont?: NameFontFamily;
  nameEffect?: NameEffectPreset;
  visuals?: CosmeticIdentityVisuals;
  avatarSize?: "sm" | "md" | "lg" | "xl";
}

export type CosmeticIdentityProps =
  | AnonymousCosmeticIdentityProps
  | IdentifiedCosmeticIdentityProps;

export function CosmeticIdentity(props: CosmeticIdentityProps) {
  const NameTag = props.nameAs ?? "span";

  if (props.anonymous) {
    const avatarSize = props.avatarSize ?? (props.mode === "preview" ? "lg" : "sm");
    return (
      <div className={`cosmetic-identity cosmetic-identity--${props.mode}`}>
        <AnonymousAvatar size={avatarSize} />
        <NameTag className="cosmetic-identity__name">Anonymous Author</NameTag>
      </div>
    );
  }

  const {
    displayName,
    avatarUrl,
    avatarFrame,
    nameFont,
    nameEffect,
    visuals,
    mode,
    avatarSize = mode === "profile" ? "xl" : mode === "preview" ? "lg" : "sm",
  } = props;
  const nameVisual = mergeCosmeticVisuals(visuals?.nameFont, visuals?.nameEffect);
  const nameStyle: CSSProperties = {
    ...(nameFont ? { fontFamily: nameFont } : {}),
    ...(cosmeticVisualStyle(nameVisual) ?? {}),
  };
  const decorativeFrame = avatarFrame ? STRUCTURAL_AVATAR_FRAMES.has(avatarFrame) : false;

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
