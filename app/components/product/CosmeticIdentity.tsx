import type { CSSProperties } from "react";
import type {
  AvatarFramePreset,
  NameEffectPreset,
  NameFontFamily,
  ProfileEffectPreset,
} from "../../../shared/store/cosmetics";
import type {
  CosmeticIdentityVisuals,
  CosmeticVisualDefinition,
} from "../../../shared/store/custom-cosmetics";
import { Avatar } from "../ui";

export interface CosmeticIdentityProps {
  displayName: string;
  avatarUrl?: string;
  avatarFrame?: AvatarFramePreset;
  profileEffect?: ProfileEffectPreset;
  nameFont?: NameFontFamily;
  nameEffect?: NameEffectPreset;
  visuals?: CosmeticIdentityVisuals;
  mode: "profile" | "compact" | "preview";
  avatarSize?: "sm" | "md" | "lg" | "xl";
  nameAs?: "span" | "strong" | "h1";
}

function mergeVisuals(
  first?: CosmeticVisualDefinition,
  second?: CosmeticVisualDefinition,
): CosmeticVisualDefinition | undefined {
  if (!first) return second;
  if (!second) return first;
  return { ...first, ...second };
}

function visualStyle(visual?: CosmeticVisualDefinition): CSSProperties | undefined {
  if (!visual) return undefined;
  return {
    "--sb-cosmetic-fg": visual.foregroundColor,
    "--sb-cosmetic-bg": visual.backgroundColor,
    "--sb-cosmetic-border": visual.borderColor,
    "--sb-cosmetic-glow": visual.glowColor,
    "--sb-cosmetic-border-width":
      visual.borderWidth === undefined ? undefined : `${visual.borderWidth}px`,
    "--sb-cosmetic-radius":
      visual.borderRadius === undefined ? undefined : `${visual.borderRadius}px`,
    "--sb-cosmetic-glow-size": visual.glowSize === undefined ? undefined : `${visual.glowSize}px`,
    "--sb-cosmetic-opacity": visual.opacity,
    "--sb-cosmetic-font-weight": visual.fontWeight,
    "--sb-cosmetic-letter-spacing":
      visual.letterSpacing === undefined ? undefined : `${visual.letterSpacing}px`,
    "--sb-cosmetic-font-style": visual.fontStyle,
    "--sb-cosmetic-text-transform": visual.textTransform,
    "--sb-cosmetic-duration":
      visual.animationDurationMs === undefined ? undefined : `${visual.animationDurationMs}ms`,
  } as CSSProperties;
}

function visualClass(visual?: CosmeticVisualDefinition): string {
  if (!visual) return "";
  return ` sb-custom-cosmetic sb-custom-cosmetic--${visual.animation ?? "none"}`;
}

export function CosmeticIdentity({
  displayName,
  avatarUrl,
  avatarFrame,
  profileEffect,
  nameFont,
  nameEffect,
  visuals,
  mode,
  avatarSize = mode === "profile" ? "xl" : mode === "preview" ? "lg" : "sm",
  nameAs = "span",
}: CosmeticIdentityProps) {
  const NameTag = nameAs;
  const effectClass =
    profileEffect && profileEffect !== "none" ? ` cosmetic-identity--effect-${profileEffect}` : "";
  const nameVisual = mergeVisuals(visuals?.nameFont, visuals?.nameEffect);
  const nameStyle: CSSProperties = {
    ...(nameFont ? { fontFamily: nameFont } : {}),
    ...(visualStyle(nameVisual) ?? {}),
  };

  return (
    <div
      className={`cosmetic-identity cosmetic-identity--${mode}${effectClass}${visualClass(visuals?.profileEffect)}`}
      style={visualStyle(visuals?.profileEffect)}
    >
      <span
        className={`cosmetic-identity__avatar-shell${visualClass(visuals?.avatarFrame)}`}
        style={visualStyle(visuals?.avatarFrame)}
      >
        <Avatar
          name={displayName}
          src={avatarUrl}
          size={avatarSize}
          className={avatarFrame ? `sb-avatar--frame-${avatarFrame}` : undefined}
        />
      </span>
      <NameTag
        className={`cosmetic-identity__name${nameEffect ? ` sb-name-effect--${nameEffect}` : ""}${visualClass(nameVisual)}`}
        style={nameStyle}
      >
        {displayName}
      </NameTag>
    </div>
  );
}
