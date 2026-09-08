export const SOCIAL_PLATFORMS = [
  "instagram",
  "tiktok",
  "x",
  "youtube",
  "twitch",
  "discord",
  "github",
  "bluesky",
  "reddit",
  "website",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface SocialPlatformDefinition {
  id: SocialPlatform;
  label: string;
  icon: SocialPlatform;
  inputLabel: string;
  placeholder: string;
}

export const SOCIAL_PLATFORM_CATALOG: Record<SocialPlatform, SocialPlatformDefinition> = {
  instagram: {
    id: "instagram",
    label: "Instagram",
    icon: "instagram",
    inputLabel: "Username or profile URL",
    placeholder: "@username",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    icon: "tiktok",
    inputLabel: "Username or profile URL",
    placeholder: "@username",
  },
  x: {
    id: "x",
    label: "X / Twitter",
    icon: "x",
    inputLabel: "Username or profile URL",
    placeholder: "@username",
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    icon: "youtube",
    inputLabel: "Handle or channel URL",
    placeholder: "@channel",
  },
  twitch: {
    id: "twitch",
    label: "Twitch",
    icon: "twitch",
    inputLabel: "Username or channel URL",
    placeholder: "username",
  },
  discord: {
    id: "discord",
    label: "Discord",
    icon: "discord",
    inputLabel: "User ID, profile URL or invite URL",
    placeholder: "123456789012345678",
  },
  github: {
    id: "github",
    label: "GitHub",
    icon: "github",
    inputLabel: "Username or profile URL",
    placeholder: "username",
  },
  bluesky: {
    id: "bluesky",
    label: "Bluesky",
    icon: "bluesky",
    inputLabel: "Handle or profile URL",
    placeholder: "name.bsky.social",
  },
  reddit: {
    id: "reddit",
    label: "Reddit",
    icon: "reddit",
    inputLabel: "Username or profile URL",
    placeholder: "username",
  },
  website: {
    id: "website",
    label: "Website",
    icon: "website",
    inputLabel: "HTTPS URL",
    placeholder: "https://example.com",
  },
};

const PLATFORM_ALIASES: Record<string, SocialPlatform> = {
  instagram: "instagram",
  tiktok: "tiktok",
  x: "x",
  twitter: "x",
  "x/twitter": "x",
  youtube: "youtube",
  twitch: "twitch",
  discord: "discord",
  github: "github",
  bluesky: "bluesky",
  reddit: "reddit",
  website: "website",
  web: "website",
};

function cleanHandle(value: string): string {
  return value.trim().replace(/^@/, "").replace(/^u\//i, "");
}

export function canonicalSocialPlatform(value: unknown): SocialPlatform | null {
  if (typeof value !== "string") return null;
  return PLATFORM_ALIASES[value.trim().toLowerCase()] ?? null;
}

function parseHttps(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function hostIs(url: URL, ...hosts: string[]): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return hosts.includes(host);
}

function firstSegment(url: URL): string {
  return decodeURIComponent(url.pathname.split("/").filter(Boolean)[0] ?? "");
}

export function normalizeSocialUrl(platform: SocialPlatform, rawValue: string): string | null {
  const raw = rawValue.trim();
  if (!raw || raw.length > 2048) return null;

  if (platform === "website") {
    const url = parseHttps(raw);
    return url ? url.toString() : null;
  }

  if (!raw.includes("://")) {
    const handle = cleanHandle(raw);
    if (!handle || handle.length > 100 || /[\s?#/]/.test(handle)) return null;
    if (platform === "instagram") return `https://www.instagram.com/${encodeURIComponent(handle)}`;
    if (platform === "tiktok") return `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
    if (platform === "x") return `https://x.com/${encodeURIComponent(handle)}`;
    if (platform === "youtube") return `https://www.youtube.com/@${encodeURIComponent(handle)}`;
    if (platform === "twitch") return `https://www.twitch.tv/${encodeURIComponent(handle)}`;
    if (platform === "github") return `https://github.com/${encodeURIComponent(handle)}`;
    if (platform === "bluesky") return `https://bsky.app/profile/${encodeURIComponent(handle)}`;
    if (platform === "reddit") return `https://www.reddit.com/user/${encodeURIComponent(handle)}`;
    if (platform === "discord" && /^\d{5,32}$/.test(handle))
      return `https://discord.com/users/${handle}`;
    return null;
  }

  const url = parseHttps(raw);
  if (!url || url.username || url.password) return null;
  if (platform === "instagram" && hostIs(url, "instagram.com")) {
    const handle = cleanHandle(firstSegment(url));
    return handle ? `https://www.instagram.com/${encodeURIComponent(handle)}` : null;
  }
  if (platform === "tiktok" && hostIs(url, "tiktok.com")) {
    const handle = cleanHandle(firstSegment(url));
    return handle ? `https://www.tiktok.com/@${encodeURIComponent(handle)}` : null;
  }
  if (platform === "x" && hostIs(url, "x.com", "twitter.com")) {
    const handle = cleanHandle(firstSegment(url));
    return handle ? `https://x.com/${encodeURIComponent(handle)}` : null;
  }
  if (platform === "youtube" && hostIs(url, "youtube.com", "youtu.be")) return url.toString();
  if (platform === "twitch" && hostIs(url, "twitch.tv")) {
    const handle = cleanHandle(firstSegment(url));
    return handle ? `https://www.twitch.tv/${encodeURIComponent(handle)}` : null;
  }
  if (platform === "github" && hostIs(url, "github.com")) {
    const handle = cleanHandle(firstSegment(url));
    return handle ? `https://github.com/${encodeURIComponent(handle)}` : null;
  }
  if (platform === "bluesky" && hostIs(url, "bsky.app")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const handle = parts[0] === "profile" ? parts[1] : null;
    return handle
      ? `https://bsky.app/profile/${encodeURIComponent(decodeURIComponent(handle))}`
      : null;
  }
  if (platform === "reddit" && hostIs(url, "reddit.com")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const handle =
      parts[0]?.toLowerCase() === "user" || parts[0]?.toLowerCase() === "u" ? parts[1] : null;
    return handle
      ? `https://www.reddit.com/user/${encodeURIComponent(decodeURIComponent(handle))}`
      : null;
  }
  if (platform === "discord" && hostIs(url, "discord.com", "discord.gg")) return url.toString();
  return null;
}

export function socialHandleFromUrl(platform: SocialPlatform, rawUrl: string): string {
  const url = parseHttps(rawUrl);
  if (!url) return rawUrl;
  if (platform === "website") return url.hostname.replace(/^www\./, "");
  if (platform === "youtube") {
    const segment = firstSegment(url);
    return segment.startsWith("@") ? segment : url.pathname.replace(/^\//, "");
  }
  if (platform === "bluesky") {
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] === "profile" && parts[1] ? `@${decodeURIComponent(parts[1])}` : url.hostname;
  }
  if (platform === "reddit") {
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[1] ? `@${decodeURIComponent(parts[1])}` : url.hostname;
  }
  if (platform === "discord") {
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.at(-1) ?? url.hostname;
  }
  const handle = cleanHandle(firstSegment(url));
  return handle ? `@${handle}` : url.hostname;
}
