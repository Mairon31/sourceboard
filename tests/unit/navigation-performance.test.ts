import { describe, expect, it, vi } from "vitest";
import { createAuthService } from "../../worker/auth/service";
import type { AuthStore } from "../../worker/auth/store";
import type { AuthSessionRecord } from "../../worker/auth/types";
import type { SourceBoardEnvironment } from "../../worker/types";
import { readFileSync } from "node:fs";

function session(lastUsedAt: number): AuthSessionRecord {
  return {
    id: "session-1",
    userId: "user-1",
    tokenHash: "hash",
    expiresAt: lastUsedAt + 60 * 60_000,
    createdAt: lastUsedAt - 1_000,
    lastUsedAt,
    revokedAt: null,
    ipHash: null,
    userAgentHash: null,
    user: {
      id: "user-1",
      username: "aurora",
      email: "aurora@example.test",
      emailVerifiedAt: lastUsedAt - 10_000,
      status: "ACTIVE",
      createdAt: lastUsedAt - 20_000,
      updatedAt: lastUsedAt - 10_000,
    },
  };
}

function request() {
  return new Request("https://sourceboard.test/", {
    headers: { cookie: "__Host-sourceboard_session=test-token" },
  });
}

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("navigation session performance", () => {
  it("does not write last_used_at for a session touched moments ago", async () => {
    const now = 1_000_000;
    const touchSession = vi.fn(async () => undefined);
    const store = {
      findActiveSessionByTokenHash: vi.fn(async () => session(now - 30_000)),
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

  it("prefetches nav destinations on intent without prefetching every feed post", () => {
    const productNav = read("../../app/components/product/ProductNav.tsx");
    const postCard = read("../../app/components/product/PostCard.tsx");

    expect(productNav).toContain('prefetch="intent"');
    expect(productNav).not.toContain('prefetch="viewport"');
    expect(productNav).toContain('to="/store"');
    expect(postCard).not.toContain('prefetch="viewport"');
  });

  it("starts post and comment detail reads together after one session resolution", () => {
    const detailRoute = read("../../app/routes/post-detail.tsx");

    expect(detailRoute).toContain("Promise.all");
    expect(detailRoute).toContain("service.getPost");
    expect(detailRoute).toContain("commentService.listForPost");
  });
});