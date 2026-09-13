import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createAuthContext, createAuthService } from "../../worker/auth/service";
import { SESSION_COOKIE_NAME } from "../../worker/auth/security";
import type { ActiveSessionRecord, AuthStore } from "../../worker/auth/store";
import type { SourceBoardEnvironment } from "../../worker/environment";

const settingsSource = readFileSync(
  new URL("../../app/routes/settings.tsx", import.meta.url),
  "utf8",
);
const authApiSource = readFileSync(new URL("../../worker/auth/api.ts", import.meta.url), "utf8");

function activeSession(): ActiveSessionRecord {
  return {
    id: "current-session",
    userId: "user-1",
    tokenHash: "hash",
    createdAt: 1_000,
    lastUsedAt: 2_000,
    expiresAt: 10_000_000,
    revokedAt: null,
    ipPrefixHash: null,
    userAgentHash: null,
    ipEncrypted: null,
    ipKeyVersion: null,
    userAgent: null,
    cfCity: null,
    cfRegion: null,
    cfCountry: null,
    contextUpdatedAt: 2_000,
    username: "owner",
    status: "ACTIVE",
    emailVerifiedAt: 1_000,
  };
}

describe("Block B settings security information architecture", () => {
  it("leads with General and keeps username/password inside the Security surface", () => {
    expect(settingsSource).toContain('data-settings-surface="general"');
    expect(settingsSource).toContain('data-settings-surface="security"');
    expect(settingsSource.indexOf('data-settings-surface="general"')).toBeLessThan(
      settingsSource.indexOf('data-settings-surface="security"'),
    );

    const securityStart = settingsSource.indexOf('data-settings-surface="security"');
    const securitySource = settingsSource.slice(securityStart);
    expect(securitySource).toContain("<UsernamePanel");
    expect(securitySource).toContain("<PasswordPanel");
    expect(securitySource).toContain("<SessionSecurityPanel");
  });

  it("renders observed professional session labels/details without generic browser placeholders", () => {
    expect(settingsSource).not.toContain("Current browser");
    expect(settingsSource).not.toContain("Active browser");
    expect(settingsSource).toContain("session.browser.name");
    expect(settingsSource).toContain("session.os.name");
    expect(settingsSource).toContain("session.ipMasked");
    expect(settingsSource).toContain("session.ip");
    expect(settingsSource).toContain("session.location");
    expect(settingsSource).toContain("session.createdAt");
    expect(settingsSource).toContain("session.expiresAt");
    expect(settingsSource).toContain("aria-expanded");
  });

  it("uses the explicit revoke-other-sessions endpoint instead of logging out the current browser", () => {
    expect(settingsSource).toContain("Sign out other sessions");
    expect(settingsSource).toContain('fetch("/api/auth/sessions"');
    expect(settingsSource).toContain('method: "DELETE"');
    expect(authApiSource).toContain('"DELETE /api/auth/sessions"');
  });

  it("revokes every other session while preserving the authenticated current session", async () => {
    const revokeOtherSessions = vi.fn(async () => undefined);
    const store = {
      findActiveSessionByTokenHash: vi.fn(async () => activeSession()),
      revokeOtherSessions,
      writeAuditLog: vi.fn(async () => undefined),
    } as unknown as AuthStore;
    const service = createAuthService({
      store,
      env: {} as SourceBoardEnvironment,
      now: () => 5_000,
    }) as ReturnType<typeof createAuthService> & {
      signOutOtherSessions?: (context: ReturnType<typeof createAuthContext>) => Promise<void>;
    };
    const request = new Request("https://sourceboard.test/settings", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=raw-session-token` },
    });
    const context = createAuthContext(request, "revoke-other-sessions");

    expect(service.signOutOtherSessions).toBeTypeOf("function");
    if (!service.signOutOtherSessions) return;
    await service.signOutOtherSessions(context);

    expect(revokeOtherSessions).toHaveBeenCalledWith("user-1", "current-session", 5_000);
  });
});
