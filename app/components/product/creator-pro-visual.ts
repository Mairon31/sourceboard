import type { CSSProperties } from "react";
import type { CosmeticVisualConfigV1 } from "../../../shared/store/cosmetic-config";

export type CreatorProVisualTarget = "theme" | "effect" | "avatar" | "name";
export type CreatorProRenderContext = "profile" | "preview" | "compact" | "store" | "admin";

type CreatorProStyle = CSSProperties & Record<`--creator-${string}`, string | number>;

function gradientFor(config: CosmeticVisualConfigV1): string {
  if (config.gradient) {
    const stops = config.gradient.stops
      .map((stop) => `${stop.color} ${Math.round(stop.position * 10000) / 100}%`)
      .join(", ");
    return `linear-gradient(${config.gradient.angle}deg, ${stops})`;
  }
  if (config.palette.length === 1) return config.palette[0] ?? "#ffffff";
  const lastIndex = Math.max(config.palette.length - 1, 1);
  return `linear-gradient(135deg, ${config.palette
    .map((color, index) => `${color} ${Math.round((index / lastIndex) * 10000) / 100}%`)
    .join(", ")})`;
}

function animationStyle(config: CosmeticVisualConfigV1): CSSProperties {
  const animation = config.animation;
  if (!animation) return {};
  return {
    animationDuration: `${animation.durationMs}ms`,
    animationDelay: `${animation.delayMs}ms`,
    animationTimingFunction: animation.easing,
    animationDirection: animation.direction,
    animationIterationCount: String(animation.iterations),
  };
}

export function creatorProVisualStyle(
  config: CosmeticVisualConfigV1 | undefined,
  target: CreatorProVisualTarget,
): CSSProperties | undefined {
  if (!config) return undefined;
  const primary = config.palette[0] ?? "#ffffff";
  const secondary = config.palette[1] ?? primary;
  const gradient = gradientFor(config);
  const glow = config.glow;
  const style: CreatorProStyle = {
    "--creator-primary": primary,
    "--creator-secondary": secondary,
    "--creator-gradient": gradient,
    "--creator-intensity": config.intensity ?? 1,
    "--creator-glow-blur": `${glow?.blurPx ?? 0}px`,
    "--creator-glow-opacity": glow?.opacity ?? 0,
    ...(config.animation
      ? {
          "--creator-duration": `${config.animation.durationMs}ms`,
          "--creator-delay": `${config.animation.delayMs}ms`,
        }
      : {}),
    ...(config.opacity !== undefined ? { opacity: config.opacity } : {}),
    ...(config.blendMode ? { mixBlendMode: config.blendMode } : {}),
    ...animationStyle(config),
  };

  if (target === "theme") {
    style.background = gradient;
    if (glow && glow.blurPx > 0 && glow.opacity > 0) {
      style.boxShadow = `inset 0 0 ${glow.blurPx}px color-mix(in srgb, ${primary} ${Math.round(glow.opacity * 100)}%, transparent)`;
    }
  } else if (target === "effect" || target === "avatar") {
    style.color = primary;
    if (glow && glow.blurPx > 0 && glow.opacity > 0) {
      style.filter = `drop-shadow(0 0 ${glow.blurPx}px color-mix(in srgb, ${primary} ${Math.round(glow.opacity * 100)}%, transparent))`;
    }
  } else if (target === "name") {
    style.backgroundImage = gradient;
    style.backgroundClip = "text";
    style.WebkitBackgroundClip = "text";
    style.color = "transparent";
    if (glow && glow.blurPx > 0 && glow.opacity > 0) {
      style.textShadow = `0 0 ${glow.blurPx}px color-mix(in srgb, ${primary} ${Math.round(glow.opacity * 100)}%, transparent)`;
    }
  }
  return style;
}

export function creatorProParticleNodeCount(
  config: CosmeticVisualConfigV1 | undefined,
  context: CreatorProRenderContext,
): number {
  const requested = config?.particles?.count ?? 0;
  const ceiling = context === "compact" ? 8 : context === "store" ? 12 : context === "preview" || context === "admin" ? 24 : 48;
  return Math.max(0, Math.min(requested, ceiling));
}
