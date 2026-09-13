import type { CSSProperties } from "react";
import type {
  NameEffectPreset,
  NameFontFamily,
} from "../../../shared/store/cosmetics";
import type { CosmeticIdentityVisuals } from "../../../shared/store/custom-cosmetics";
import { AvatarStage } from "./AvatarStage";
import { FontResources } from "./FontResources";
import { cosmeticVisualClass, cosmeticVisualStyle, mergeCosmeticVisuals } from "./cosmetic-visual";
import "./avatar-frames.css";

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
  avatarFrame?: import("../../../shared/store/cosmetics").AvatarFramePreset;
  nameFont?: NameFontFamily;
  nameEffect?: NameEffectPreset;
  visuals?: CosmeticIdentityVisuals;
  avatarSize?: "sm" | "md" | "lg" | "xl";
}

export type CosmeticIdentityProps =
  | AnonymousCosmeticIdentityProps
  | IdentifiedCosmeticIdentityProps;

function stageSize(
  mode: CosmeticIdentityBaseProps["mode"],
  avatarSize?: IdentifiedCosmeticIdentityProps["avatarSize"],
): "sm" | "md" | "lg" | "xl" | "preview" {
  if (mode === "preview") return "preview";
  return avatarSize ?? (mode === "profile" ? "xl" : "sm");
}

function graphemes(value: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const Segmenter = Intl.Segmenter as new (
      locales?: string | string[],
      options?: { granularity: "grapheme" },
    ) => { segment(input: string): Iterable<{ segment: string }> };
    return [...new Segmenter(undefined, { granularity: "grapheme" }).segment(value)].map(
      (part) => part.segment,
    );
  }
  return Array.from(value);
}

function NameContent({ displayName, nameEffect }: { displayName: string; nameEffect?: NameEffectPreset }) {
  if (nameEffect !== "sequential-bounce" && nameEffect !== "bounce-neon") return displayName;
  return graphemes(displayName).map((letter, index) => (
    <span key={`${letter}-${index}`} className="sb-name-effect__grapheme" style={{ "--name-letter-index": index } as CSSProperties} aria-hidden="true">
      {letter}
    </span>
  ));
}

export function CosmeticIdentity(props: CosmeticIdentityProps) {
  const NameTag = props.nameAs ?? "span";

  if (props.anonymous) {
    return (
      <div className={`cosmetic-identity cosmetic-identity--${props.mode}`}>
        <AvatarStage alt="Anonymous Author" size={props.mode === "preview" ? "preview" : props.avatarSize ?? "sm"} anonymous />
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
    avatarSize,
  } = props;
  const nameVisual = mergeCosmeticVisuals(visuals?.nameFont, visuals?.nameEffect);
  const nameStyle: CSSProperties = {
    ...(nameFont ? { fontFamily: `"${nameFont}", system-ui, sans-serif` } : {}),
    ...(cosmeticVisualStyle(nameVisual) ?? {}),
  };

  return (
    <div className={`cosmetic-identity cosmetic-identity--${mode}`}>
      {nameFont ? <FontResources families={[nameFont]} /> : null}
      <AvatarStage
        alt={displayName}
        avatarUrl={avatarUrl}
        frame={avatarFrame}
        size={stageSize(mode, avatarSize)}
        className={cosmeticVisualClass(visuals?.avatarFrame).trim() || undefined}
        style={cosmeticVisualStyle(visuals?.avatarFrame)}
      />
      <NameTag
        className={`cosmetic-identity__name profile-name-area${nameEffect ? ` sb-name-effect--${nameEffect}` : ""}${cosmeticVisualClass(nameVisual)}`}
        style={nameStyle}
        aria-label={displayName}
      >
        <NameContent displayName={displayName} nameEffect={nameEffect} />
      </NameTag>
    </div>
  );
}
