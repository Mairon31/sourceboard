import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createAuthService } from "../../worker/auth/service";
import { SESSION_COOKIE_NAME } from "../../worker/auth/security";
import type { AuthStore, SessionRecord } from "../../worker/auth/store";
import type { SourceBoardEnvironment } from "../../worker/environment";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function session(lastUsedAt: number): SessionRecord & {
  username: string;
  status: "ACTIVE";
  emailVerifiedAt: number;
} {
  return {
    id: "session-1",
    userId: "user-1",
    tokenHash: "hash",
    createdAt: 1_000,
    lastUsedAt,
    expiresAt: 10_000_000,
    revokedAt: null,
    ipPrefixHash: null,
    userAgentHash: null,
    username: "aurora",
    status: "ACTIVE",
    emailVerifiedAt: 1_000,
  };
}

function request() {
  return new Request("https://srcboard.me/store", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=opaque-session-token` },
  });
}

describe("navigation session performance", () => {
  it("does not write last_used_at for a session touched moments ago", async () => {
    const now = 1_000_000;
    const touchSession = vi.fn(async () => undefined);
    const store = {
      findActiveSessionByTokenHash: vi.fn(async () => session(now - 5_000)),
      touchSession,
    } as unknown as AuthStore;
    const service = createAuthService({
      store,
      env: {} as SourceBoardEnvironment,
      now: () => now,
    });

    await expect(service.getSession(request())).resolves.toBeTruthy();
    expect(touchSession).not.toHaveBeenCalled();
  });

  it("still refreshes activity for a stale active session", async () => {
    const now = 1_000_000;
    const touchSession = vi.fn(async () => undefined);
    const store = {
      findActiveSessionByTokenHash: vi.fn(async () => session(now - 10 * 60_000)),
      touchSession,
    } as unknown as AuthStore;
    const service = createAuthService({
      store,
      env: {} as SourceBoardEnvironment,
      now: () => now,
    });

    await expect(service.getSession(request())).resolves.toBeTruthy();
    expect(touchSession).toHaveBeenCalledTimes(1);
  });

  it("shares one session resolution across root and child loaders in the same request context", () => {
    const routerContext = read("../../shared/router-context.ts");
    const serverRequest = read("../../app/data/server-request.ts");
    const root = read("../../app/root.tsx");

    expect(routerContext).toContain("sessionPromise");
    expect(serverRequest).toContain("requestContext.sessionPromise");
    expect(root).toContain("readServerSession");
  });
});
