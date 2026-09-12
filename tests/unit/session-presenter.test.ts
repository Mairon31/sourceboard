import { describe, expect, it } from "vitest";
import {
  maskSessionIp,
  parseSessionUserAgent,
  presentSession,
} from "../../worker/auth/session-presenter";
import type { SessionRecord } from "../../worker/auth/store";

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
});
