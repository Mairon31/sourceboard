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

export function parseSessionUserAgent(userAgent: string | null | undefined): ParsedSessionUserAgent {
  void userAgent;
  return {
    browser: { name: "unknown" },
    os: { name: "unknown" },
    deviceType: "unknown",
  };
}

export function maskSessionIp(ipAddress: string | null | undefined): string | undefined {
  void ipAddress;
  return undefined;
}

export function presentSession(
  session: SessionRecord,
  current: boolean,
  ipAddress: string | null,
): SessionView {
  return {
    id: session.id,
    current,
    ...parseSessionUserAgent(session.userAgent),
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    ...(maskSessionIp(ipAddress) ? { ipMasked: maskSessionIp(ipAddress) } : {}),
    ...(ipAddress ? { ip: ipAddress } : {}),
  };
}
