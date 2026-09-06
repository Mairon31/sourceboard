import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import {
  badgeClassName,
  joinClassNames,
  type BadgeTone,
} from "../../../shared/design/component-variants";

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: SurfaceProps) {
  return (
    <div className={joinClassNames("sb-card", className)} {...props}>
      {children}
    </div>
  );
}

export function GlassPanel({ className, children, ...props }: SurfaceProps) {
  return (
    <div className={joinClassNames("glass-panel", "sb-glass-panel", className)} {...props}>
      {children}
    </div>
  );
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span className={badgeClassName(tone, className)} {...props}>
      {children}
    </span>
  );
}

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  radius?: string;
}

export function Skeleton({ width, height, radius, className, style, ...props }: SkeletonProps) {
  const skeletonStyle: CSSProperties = {
    width,
    height,
    borderRadius: radius,
    ...style,
  };

  return (
    <div
      className={joinClassNames("sb-skeleton", "skeleton-shimmer", className)}
      style={skeletonStyle}
      aria-hidden="true"
      {...props}
    />
  );
}

export interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  return (
    <BaseAvatar.Root
      className={joinClassNames("sb-avatar", `sb-avatar--${size}`, className)}
      aria-label={name}
    >
      {src ? <BaseAvatar.Image className="sb-avatar__image" src={src} alt="" /> : null}
      <BaseAvatar.Fallback className="sb-avatar__fallback">{initials(name)}</BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}
