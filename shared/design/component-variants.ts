export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "nsfw";

export function joinClassNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return joinClassNames(
    "sb-button",
    `sb-button--${variant}`,
    `sb-button--${size}`,
    "motion-interactive",
    className,
  );
}

export function badgeClassName(tone: BadgeTone = "neutral", className?: string): string {
  return joinClassNames("sb-badge", `sb-badge--${tone}`, className);
}
