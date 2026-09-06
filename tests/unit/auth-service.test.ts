import { describe, expect, it, vi } from "vitest";
import { encryptEmail, hashPassword, hashOpaqueToken } from "../../worker/auth/crypto";
import { createAuthService, type AuthServiceContext } from "../../worker/auth/service";
import type { SourceBoardEnvironment } from "../../worker/environment";
import type { AuthStore, SessionRecord, UserRecord } from "../../worker/auth/store";

const rateLimit = { limit: vi.fn(async () => ({ success: true })) } as unknown as RateLimit;
const baseEnvironment: SourceBoardEnvironment = {
  RATE_LIMIT_AUTH: rateLimit,
  TURNSTILE_SITE_KEY: "site-key",
  TURNSTILE_SECRET: "test-secret",
  EMAIL_FROM: "noreply@example.test",
  EMAIL: { send: vi.fn(async () => ({ messageId: "message" })) } as unknown as SendEmail,
  EMAIL_LOOKUP_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
  DATA_ENCRYPTION_KEY_V1: Buffer.alloc(32, 9).toString("base64"),
};

const request = new Request("https://sourceboard.test/api/auth/login", {
  method: "POST",
  headers: { origin: "https://sourceboard.test", "cf-connecting-ip": "203.0.113.10" },
});

function context(overrides: Partial<AuthServiceContext> = {}): AuthServiceContext {
  return {
    request,
    requestId: "auth-test",
    security: {
      ipAddress: "203.0.113.10",
      ipPrefixHash: "hashed-ip",
      userAgentHash: "hashed-agent",
    },
    ...overrides,
  };
}

function user(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: "user-1",
    username: "Aurora",
    usernameNormalized: "aurora",
    emailLookupHash: "email-hash",
    emailEncrypted: "v1.iv.tag.cipher",
    emailKeyVersion: "v1",
    status: "ACTIVE",
    emailVerifiedAt: 1000,
    createdAt: 1000,
    updatedAt: 1000,
    lastSeenAt: null,
    ...overrides,
  };
}

describe("authentication service", () => {
  it("registers pending users, sends a verification link, and consumes it once", async () => {
    let createdUser: UserRecord | null = null;
    let createdTokenHash = "";
    let verified = false;
    const sent: string[] = [];
    const store = {
      findUserByEmailLookupHash: vi.fn(async () => null),
      findUserByUsernameNormalized: vi.fn(async () => null),
      createUser: vi.fn(
        async (input: { user: UserRecord; verificationToken: { tokenHash: string } }) => {
          createdUser = input.user;
          createdTokenHash = input.verificationToken.tokenHash;
        },
      ),
      writeAuditLog: vi.fn(async () => undefined),
      consumeEmailVerificationToken: vi.fn(async (tokenHash: string) => {
        if (verified || tokenHash !== createdTokenHash) return null;
        verified = true;
        return createdUser?.id ?? null;
      }),
      markEmailVerified: vi.fn(async () => undefined),
    } as unknown as AuthStore;
    const service = createAuthService({
      store,
      env: baseEnvironment,
      now: () => 1000,
      verifyTurnstile: vi.fn(async () => undefined),
      sendEmail: vi.fn(async (message) => {
        sent.push(message.text);
      }),
    });

    const result = await service.register(
      {
        username: "Aurora",
        email: "Alice@example.com",
        password: "correct horse battery staple",
        turnstileToken: "turnstile-token",
      },
      context({
        request: new Request("https://sourceboard.test/api/auth/register", { method: "POST" }),
      }),
    );

    expect(result).toEqual({ verificationRequired: true });
    expect((createdUser as UserRecord | null)?.status).toBe("PENDING_VERIFICATION");
    expect(sent).toHaveLength(1);
    const token = new URL(sent[0]?.split("\n\n")[1] ?? "").searchParams.get("token");
    expect(token).toBeTruthy();
    expect(createdTokenHash).toBe(hashOpaqueToken(token ?? ""));
    expect(createdTokenHash).not.toContain(token ?? "");

    await expect(service.verifyEmail(token ?? "", context())).resolves.toEqual({ verified: true });
    await expect(service.verifyEmail(token ?? "", context())).rejects.toMatchObject({
      code: "VERIFICATION_TOKEN_INVALID",
    });
  });

  it("uses a generic login failure, rotates an existing session, and stores only token hashes", async () => {
    const credentials = await hashPassword("correct horse battery staple");
    const sessions: SessionRecord[] = [];
    const currentUser = user();
    const store = {
      findUserByEmailLookupHash: vi.fn(async () => currentUser),
      getCredentials: vi.fn(async () => credentials),
      getLoginFailureState: vi.fn(async () => null),
      clearLoginFailure: vi.fn(async () => undefined),
      recordLoginFailure: vi.fn(async () => undefined),
      findActiveSessionByTokenHash: vi.fn(async (tokenHash: string) => {
        const found = sessions.find(
          (session) => session.tokenHash === tokenHash && !session.revokedAt,
        );
        return found
          ? {
              ...found,
              username: currentUser.username,
              status: currentUser.status,
              emailVerifiedAt: currentUser.emailVerifiedAt,
            }
          : null;
      }),
      revokeSession: vi.fn(async (sessionId: string, _userId: string, now: number) => {
        const found = sessions.find((session) => session.id === sessionId);
        if (found) found.revokedAt = now;
      }),
      createSession: vi.fn(async (session: SessionRecord) => sessions.push(session)),
      writeAuditLog: vi.fn(async () => undefined),
      touchSession: vi.fn(async () => undefined),
      updatePasswordRecord: vi.fn(async () => undefined),
    } as unknown as AuthStore;
    const service = createAuthService({
      store,
      env: baseEnvironment,
      now: () => 2000,
    });

    await expect(
      service.login({ email: "unknown@example.com", password: "wrong password" }, context()),
    ).rejects.toMatchObject({
      code: "AUTHENTICATION_FAILED",
      publicMessage: "Email or password is incorrect.",
    });

    const first = await service.login(
      { email: "alice@example.com", password: "correct horse battery staple" },
      context(),
    );
    const firstSession = sessions[0];
    expect(firstSession?.tokenHash).not.toContain(first.cookies[0]?.value ?? "");

    const cookieRequest = new Request("https://sourceboard.test/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://sourceboard.test",
        cookie: `${first.cookies[0]?.name}=${first.cookies[0]?.value}`,
      },
    });
    await service.login(
      { email: "alice@example.com", password: "correct horse battery staple" },
      context({ request: cookieRequest }),
    );

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.revokedAt).toBe(2000);
  });

  it("does not disclose whether a valid credential belongs to an unverified account", async () => {
    const credentials = await hashPassword("correct horse battery staple");
    const store = {
      findUserByEmailLookupHash: vi.fn(async () =>
        user({ status: "PENDING_VERIFICATION", emailVerifiedAt: null }),
      ),
      getCredentials: vi.fn(async () => credentials),
      getLoginFailureState: vi.fn(async () => null),
      clearLoginFailure: vi.fn(async () => undefined),
      recordLoginFailure: vi.fn(async () => undefined),
    } as unknown as AuthStore;
    const service = createAuthService({ store, env: baseEnvironment, now: () => 2000 });

    await expect(
      service.login(
        { email: "alice@example.com", password: "correct horse battery staple" },
        context(),
      ),
    ).rejects.toMatchObject({
      code: "AUTHENTICATION_FAILED",
      publicMessage: "Email or password is incorrect.",
    });
  });

  it("makes password reset tokens single-use and revokes sessions", async () => {
    let resetHash = "";
    let consumed = false;
    const store = {
      findUserByEmailLookupHash: vi.fn(async () =>
        user({
          emailEncrypted: encryptEmail(
            "alice@example.com",
            baseEnvironment.DATA_ENCRYPTION_KEY_V1 ?? "",
          ),
        }),
      ),
      createPasswordResetToken: vi.fn(async (input: { tokenHash: string }) => {
        resetHash = input.tokenHash;
      }),
      consumePasswordResetToken: vi.fn(async (tokenHash: string) => {
        if (consumed || tokenHash !== resetHash) return null;
        consumed = true;
        return "user-1";
      }),
      replacePasswordAndRevokeSessions: vi.fn(async () => undefined),
      writeAuditLog: vi.fn(async () => undefined),
    } as unknown as AuthStore;
    const sent: string[] = [];
    const service = createAuthService({
      store,
      env: baseEnvironment,
      now: () => 3000,
      verifyTurnstile: vi.fn(async () => undefined),
      sendEmail: vi.fn(async (message) => {
        sent.push(message.text);
      }),
    });

    await service.forgotPassword(
      { email: "alice@example.com", turnstileToken: "turnstile-token" },
      context(),
    );
    const token = new URL(sent[0]?.split("\n\n")[1] ?? "").searchParams.get("token") ?? "";
    expect(resetHash).toBe(hashOpaqueToken(token));

    await expect(
      service.resetPassword(
        { token, password: "new correct horse battery staple", turnstileToken: "token" },
        context(),
      ),
    ).resolves.toEqual({ reset: true, cookies: expect.any(Array) });
    await expect(
      service.resetPassword(
        { token, password: "another correct horse battery staple", turnstileToken: "token" },
        context(),
      ),
    ).rejects.toMatchObject({ code: "RESET_TOKEN_INVALID" });
  });
});
