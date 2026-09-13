import type { CSSProperties } from "react";
import type { CosmeticVisualConfigV1 } from "../../../shared/store/cosmetic-config";
import type { AvatarFramePreset } from "../../../shared/store/cosmetics";
import { Avatar } from "../ui";
import { AnonymousAvatar } from "./AnonymousAvatar";
import { AVATAR_FRAME_DEFINITIONS, AVATAR_STAGE_LAYER_ORDER } from "./avatar-frame-definitions";
import { creatorProVisualStyle } from "./creator-pro-visual";
import "./avatar-stage.css";
import "./avatar-frames.css";
import "./creator-pro-visual.css";

export interface AvatarStageProps {
  avatarUrl?: string;
  alt: string;
  frame?: AvatarFramePreset | null;
  size: "sm" | "md" | "lg" | "xl" | "preview";
  anonymous?: boolean;
  className?: string;
  style?: CSSProperties;
  creatorPro?: CosmeticVisualConfigV1;
}

function avatarSize(size: AvatarStageProps["size"]): "sm" | "md" | "lg" | "xl" {
  return size === "preview" ? "lg" : size;
}

export function AvatarStage({
  avatarUrl,
  alt,
  frame,
  size,
  anonymous = false,
  className,
  style,
  creatorPro,
}: AvatarStageProps) {
  const definition = frame ? AVATAR_FRAME_DEFINITIONS[frame] : undefined;
  return (
    <span
      className={`product-avatar-stage profile-avatar-area${frame ? " product-avatar-frame--decorative" : ""}${className ? ` ${className}` : ""}`}
      data-size={size}
      data-avatar-frame={frame ?? undefined}
      data-creator-pro={creatorPro ? "true" : undefined}
      style={{ ...style, ...(creatorProVisualStyle(creatorPro, "avatar") ?? {}) }}
    >
      <span className="product-avatar-stage__avatar">
        {anonymous ? (
          <AnonymousAvatar size={size === "xl" || size === "preview" ? "lg" : size} />
        ) : (
          <Avatar
            name={alt}
            src={avatarUrl}
            size={avatarSize(size)}
            className={frame ? `sb-avatar--frame-${frame}` : undefined}
          />
        )}
      </span>
      {AVATAR_STAGE_LAYER_ORDER.flatMap((layer) =>
        (definition?.parts ?? [])
          .filter((part) => part.geometry.layer === layer)
          .map((part) => {
            const geometry = part.geometry;
            const variables = {
              "--avatar-part-scale": geometry.scale,
              "--avatar-part-x": geometry.offsetX,
              "--avatar-part-y": geometry.offsetY,
              "--avatar-part-rotation": `${geometry.rotation}deg`,
              ...(geometry.animationDurationMs
                ? { "--avatar-part-duration": `${geometry.animationDurationMs}ms` }
                : {}),
              ...(geometry.intensity !== undefined
                ? { "--avatar-part-intensity": geometry.intensity }
                : {}),
            } as CSSProperties;
            return (
              <span
                key={part.id}
                className="product-avatar-stage__part"
                data-layer={layer}
                data-anchor={geometry.anchor}
                style={variables}
                aria-hidden="true"
              />
            );
          }),
      )}
    </span>
  );
}
