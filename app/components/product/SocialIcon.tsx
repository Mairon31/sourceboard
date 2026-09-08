import type { SocialPlatform } from "../../../shared/profile/social-links";

export function SocialIcon({ platform, size = 18 }: { platform: SocialPlatform; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (platform === "instagram") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (platform === "tiktok") {
    return (
      <svg {...common}>
        <path d="M14 4v10.2a4 4 0 1 1-3-3.88" />
        <path d="M14 4c.9 2.5 2.4 3.8 5 4" />
      </svg>
    );
  }
  if (platform === "x") {
    return (
      <svg {...common}>
        <path d="M5 4l14 16M19 4L5 20" />
      </svg>
    );
  }
  if (platform === "youtube") {
    return (
      <svg {...common}>
        <rect x="3.5" y="6" width="17" height="12" rx="4" />
        <path d="M10 9l5 3-5 3z" />
      </svg>
    );
  }
  if (platform === "twitch") {
    return (
      <svg {...common}>
        <path d="M5 4h15v11l-5 5h-4l-2 2v-2H5z" />
        <path d="M10 8v5M15 8v5" />
      </svg>
    );
  }
  if (platform === "discord") {
    return (
      <svg {...common}>
        <path d="M7 7c3-1 7-1 10 0 1.3 2 2 4.3 2 7-2.1 1.7-4.3 2.7-7 3-2.7-.3-4.9-1.3-7-3 0-2.7.7-5 2-7z" />
        <circle cx="9.5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (platform === "github") {
    return (
      <svg {...common}>
        <path d="M9 19c-4 1.2-4-2-5-2.5M14 22v-3.1c0-.9.3-1.7.9-2.2 3-.4 6.1-1.5 6.1-6.4A5 5 0 0 0 19.7 7c.1-.8.1-2.1-.5-3.2 0 0-1.1-.3-3.5 1.3a12 12 0 0 0-7 0C6.3 3.5 5.2 3.8 5.2 3.8A6.2 6.2 0 0 0 4.7 7a5 5 0 0 0-1.3 3.3c0 4.9 3.1 6 6.1 6.4.6.5.9 1.2.9 2.2V22" />
      </svg>
    );
  }
  if (platform === "bluesky") {
    return (
      <svg {...common}>
        <path d="M12 11c-1.8-3.1-4.8-6-7-6-1.6 0-2 1.3-2 2.4 0 2.2 1.8 4.2 6.2 4.8-4.4.6-5.8 2.8-5.2 4.9.7 2.4 4.3 2.7 8-2 3.7 4.7 7.3 4.4 8 2 .6-2.1-.8-4.3-5.2-4.9C19.2 11.6 21 9.6 21 7.4 21 6.3 20.6 5 19 5c-2.2 0-5.2 2.9-7 6z" />
      </svg>
    );
  }
  if (platform === "reddit") {
    return (
      <svg {...common}>
        <circle cx="12" cy="13" r="6" />
        <path d="M9 13h.01M15 13h.01M9.5 16c1.6 1 3.4 1 5 0M13.5 7l1-3 3 1" />
        <circle cx="19" cy="9" r="2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 3.2 2.8 14.8 0 18M12 3c-2.8 3.2-2.8 14.8 0 18" />
    </svg>
  );
}
