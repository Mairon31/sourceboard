import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import { encryptSessionIp } from "../../worker/auth/crypto";
import { createAuthContext, createAuthService } from "../../worker/auth/service";
import {
  maskSessionIp,
  parseSessionUserAgent,
  presentSession,
} from "../../worker/auth/session-presenter";
import { SESSION_COOKIE_NAME } from "../../worker/auth/security";
import type { ActiveSessionRecord, AuthStore, SessionRecord } from "../../worker/auth/store";
import type { SourceBoardEnvironment } from "../../worker/environment";

const chromeWindows =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const safariIphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const firefoxLinux = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";

function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "session-1",
    userId: "user-1",
    tokenHash: "hash",
    createdAt: 1_000,
    lastUsedAt: 2_000,
    expiresAt: 3_000,
    revokedAt: null,
    ipPrefixHash: null,
    userAgentHash: null,
    ipEncrypted: null,
    ipKeyVersion: null,
    userAgent: null,
    cfCity: null,
    cfRegion: null,
    cfCountry: null,
    contextUpdatedAt: null,
    ...overrides,
  };
}

describe("professional session presenter", () => {
  it("parses representative browsers, operating systems and device classes without inventing hardware", () => {
    expect(parseSessionUserAgent(chromeWindows)).toEqual({
      browser: { name: "Chrome", version: "128.0.0.0" },
      os: { name: "Windows", version: "10" },
      deviceType: "desktop",
    });
    expect(parseSessionUserAgent(safariIphone)).toEqual({
      browser: { name: "Safari", version: "17.5" },
      os: { name: "iOS", version: "17.5" },
      deviceType: "mobile",
    });
    expect(parseSessionUserAgent(firefoxLinux)).toEqual({
      browser: { name: "Firefox", version: "128.0" },
      os: { name: "Linux" },
      deviceType: "desktop",
    });

    const parsed = parseSessionUserAgent(safariIphone) as unknown as Record<string, unknown>;
    expect(parsed).not.toHaveProperty("model");
    expect(parsed).not.toHaveProperty("deviceModel");
  });

  it("keeps unknown user agents unknown instead of guessing", () => {
    expect(parseSessionUserAgent("SourceBoardClient/1.0")).toEqual({
      browser: { name: "unknown" },
      os: { name: "unknown" },
      deviceType: "unknown",
    });
    expect(parseSessionUserAgent(null)).toEqual({
      browser: { name: "unknown" },
      os: { name: "unknown" },
      deviceType: "unknown",
    });
  });

  it("masks IPv4 and IPv6 addresses without leaking the hidden suffix", () => {
    expect(maskSessionIp("203.0.113.42")).toBe("203.0.113.xxx");
    expect(maskSessionIp("2001:db8:abcd:1234:5678:90ab:cdef:1234")).toBe(
      "2001:db8:abcd:1234:xxxx:xxxx:xxxx:xxxx",
    );
    expect(maskSessionIp(null)).toBeUndefined();
  });

  it("builds a professional owner-only view from observed session context", () => {
    expect(
      presentSession(
        session({
          userAgent: safariIphone,
          cfCity: "Puntarenas",
          cfRegion: "Puntarenas",
          cfCountry: "CR",
        }),
        true,
        "203.0.113.42",
      ),
    ).toEqual({
      id: "session-1",
      current: true,
      browser: { name: "Safari", version: "17.5" },
      os: { name: "iOS", version: "17.5" },
      deviceType: "mobile",
      location: { city: "Puntarenas", region: "Puntarenas", country: "CR" },
      ipMasked: "203.0.113.xxx",
      ip: "203.0.113.42",
      createdAt: 1_000,
      lastUsedAt: 2_000,
      expiresAt: 3_000,
    });
  });

  it("keeps legacy sessions useful without fake location or IP fields", () => {
    expect(presentSession(session(), false, null)).toEqual({
      id: "session-1",
      current: false,
      browser: { name: "unknown" },
      os: { name: "unknown" },
      deviceType: "unknown",
      createdAt: 1_000,
      lastUsedAt: 2_000,
      expiresAt: 3_000,
    });
  });

  it("wires listSessions to owner-only professional DTOs without storage secrets", async () => {
    const encryptionKey = Buffer.alloc(32, 9).toString("base64");
    const now = 2_000;
    const current = {
      ...session({
        id: "current-session",
        userAgent: safariIphone,
        ipEncrypted: encryptSessionIp("203.0.113.42", encryptionKey),
        ipKeyVersion: "v1",
        cfCity: "Puntarenas",
        cfRegion: "Puntarenas",
        cfCountry: "CR",
        contextUpdatedAt: now,
      }),
      username: "owner",
      status: "ACTIVE" as const,
      emailVerifiedAt: 1_000,
    } satisfies ActiveSessionRecord;
    const older = session({
      id: "older-session",
      userAgent: chromeWindows,
      ipEncrypted: encryptSessionIp("198.51.100.77", encryptionKey),
      ipKeyVersion: "v1",
      cfCountry: "CR",
      contextUpdatedAt: now,
    });
    const store = {
      findActiveSessionByTokenHash: vi.fn(async () => current),
      listSessions: vi.fn(async () => [current, older]),
      touchSession: vi.fn(async () => undefined),
    } as unknown as AuthStore;
    const service = createAuthService({
      store,
      env: { DATA_ENCRYPTION_KEY_V1: encryptionKey } as SourceBoardEnvironment,
      now: () => now,
    });
    const request = new Request("https://sourceboard.test/settings", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=raw-session-token` },
    });

    const views = await service.listSessions(createAuthContext(request, "session-view-test"));

    expect(store.listSessions).toHaveBeenCalledWith("user-1", now);
    expect(views[0]).toEqual({
      id: "current-session",
      current: true,
      browser: { name: "Safari", version: "17.5" },
      os: { name: "iOS", version: "17.5" },
      deviceType: "mobile",
      location: { city: "Puntarenas", region: "Puntarenas", country: "CR" },
      ipMasked: "203.0.113.xxx",
      ip: "203.0.113.42",
      createdAt: 1_000,
      lastUsedAt: 2_000,
      expiresAt: 3_000,
    });
    expect(views[1]).toEqual({
      id: "older-session",
      current: false,
      browser: { name: "Chrome", version: "128.0.0.0" },
      os: { name: "Windows", version: "10" },
      deviceType: "desktop",
      location: { country: "CR" },
      ipMasked: "198.51.100.xxx",
      ip: "198.51.100.77",
      createdAt: 1_000,
      lastUsedAt: 2_000,
      expiresAt: 3_000,
    });
    const serialized = JSON.stringify(views);
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain("ipEncrypted");
    expect(serialized).not.toContain("ipKeyVersion");
    expect(serialized).not.toContain("userAgentHash");
  });
});
