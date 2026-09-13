import type { SessionRecord } from "./store";

export interface SessionView {
  id: string;
  current: boolean;
  browser: { name: string; version?: string };
  os: { name: string; version?: string };
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  location?: { city?: string; region?: string; country?: string };
  ipMasked?: string;
  ip?: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
}

export type ParsedSessionUserAgent = Pick<SessionView, "browser" | "os" | "deviceType">;

const UNKNOWN_AGENT: ParsedSessionUserAgent = {
  browser: { name: "unknown" },
  os: { name: "unknown" },
  deviceType: "unknown",
};

function version(value: string): string {
  return value.replaceAll("_", ".");
}

function parseBrowser(userAgent: string): SessionView["browser"] {
  const edge = userAgent.match(/\bEdg\/([\d.]+)/);
  if (edge?.[1]) return { name: "Edge", version: edge[1] };

  const chrome = userAgent.match(/\bChrome\/([\d.]+)/);
  if (chrome?.[1]) return { name: "Chrome", version: chrome[1] };

  const firefox = userAgent.match(/\bFirefox\/([\d.]+)/);
  if (firefox?.[1]) return { name: "Firefox", version: firefox[1] };

  const safari = userAgent.match(/\bVersion\/([\d.]+).*\bSafari\//);
  if (safari?.[1]) return { name: "Safari", version: safari[1] };

  return { name: "unknown" };
}

function parseOperatingSystem(userAgent: string): SessionView["os"] {
  const ios = userAgent.match(/\bCPU(?: iPhone)? OS ([\d_]+)/);
  if (ios?.[1]) return { name: "iOS", version: version(ios[1]) };

  const windows = userAgent.match(/\bWindows NT ([\d.]+)/);
  if (windows?.[1]) {
    const windowsVersions: Record<string, string> = {
      "10.0": "10",
      "6.3": "8.1",
      "6.2": "8",
      "6.1": "7",
    };
    return {
      name: "Windows",
      version: windowsVersions[windows[1]] ?? windows[1],
    };
  }

  const android = userAgent.match(/\bAndroid ([\d.]+)/);
  if (android?.[1]) return { name: "Android", version: android[1] };

  const macOs = userAgent.match(/\bMac OS X ([\d_]+)/);
  if (macOs?.[1]) return { name: "macOS", version: version(macOs[1]) };

  if (/\bLinux\b/.test(userAgent)) return { name: "Linux" };
  return { name: "unknown" };
}

function parseDeviceType(
  userAgent: string,
  browser: SessionView["browser"],
  os: SessionView["os"],
): SessionView["deviceType"] {
  if (/\biPad\b|\bTablet\b|\bAndroid\b(?!.*\bMobile\b)/i.test(userAgent)) return "tablet";
  if (/\biPhone\b|\biPod\b|\bMobile\b/i.test(userAgent)) return "mobile";
  if (browser.name !== "unknown" && ["Windows", "macOS", "Linux"].includes(os.name)) {
    return "desktop";
  }
  return "unknown";
}

export function parseSessionUserAgent(
  userAgent: string | null | undefined,
): ParsedSessionUserAgent {
  const normalized = userAgent?.trim();
  if (!normalized) return UNKNOWN_AGENT;

  const browser = parseBrowser(normalized);
  const os = parseOperatingSystem(normalized);
  const deviceType = parseDeviceType(normalized, browser, os);
  if (browser.name === "unknown" && os.name === "unknown" && deviceType === "unknown") {
    return UNKNOWN_AGENT;
  }
  return { browser, os, deviceType };
}

function validIpv4Part(value: string): boolean {
  if (!/^\d{1,3}$/.test(value)) return false;
  const number = Number(value);
  return number >= 0 && number <= 255;
}

function expandIpv6(value: string): string[] | null {
  const zoneIndex = value.indexOf("%");
  const address = zoneIndex >= 0 ? value.slice(0, zoneIndex) : value;
  if (!address || !address.includes(":")) return null;

  const doubleColon = address.indexOf("::");
  if (doubleColon !== -1 && doubleColon !== address.lastIndexOf("::")) return null;

  const leftText = doubleColon === -1 ? address : address.slice(0, doubleColon);
  const rightText = doubleColon === -1 ? "" : address.slice(doubleColon + 2);
  const left = leftText ? leftText.split(":") : [];
  const right = rightText ? rightText.split(":") : [];
  if (![...left, ...right].every((part) => /^[0-9a-f]{1,4}$/i.test(part))) return null;

  if (doubleColon === -1) return left.length === 8 ? left : null;
  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;
  return [...left, ...Array.from({ length: missing }, () => "0"), ...right];
}

export function maskSessionIp(ipAddress: string | null | undefined): string | undefined {
  const normalized = ipAddress?.trim();
  if (!normalized) return undefined;

  const ipv4 = normalized.split(".");
  if (ipv4.length === 4 && ipv4.every(validIpv4Part)) {
    return `${ipv4[0]}.${ipv4[1]}.${ipv4[2]}.xxx`;
  }

  const ipv6 = expandIpv6(normalized);
  if (!ipv6) return undefined;
  return `${ipv6.slice(0, 4).join(":")}:xxxx:xxxx:xxxx:xxxx`;
}

function sessionLocation(session: SessionRecord): SessionView["location"] | undefined {
  const location: NonNullable<SessionView["location"]> = {};
  if (session.cfCity) location.city = session.cfCity;
  if (session.cfRegion) location.region = session.cfRegion;
  if (session.cfCountry) location.country = session.cfCountry;
  return Object.keys(location).length > 0 ? location : undefined;
}

export function presentSession(
  session: SessionRecord,
  current: boolean,
  ipAddress: string | null,
): SessionView {
  const location = sessionLocation(session);
  const normalizedIp = ipAddress?.trim() || null;
  const ipMasked = maskSessionIp(normalizedIp);
  return {
    id: session.id,
    current,
    ...parseSessionUserAgent(session.userAgent),
    ...(location ? { location } : {}),
    ...(ipMasked ? { ipMasked } : {}),
    ...(ipMasked && normalizedIp ? { ip: normalizedIp } : {}),
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
  };
}
