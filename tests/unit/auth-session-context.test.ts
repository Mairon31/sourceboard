import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import * as authCrypto from "../../worker/auth/crypto";
import { createAuthContext, createAuthService, type AuthService } from "../../worker/auth/service";
import * as authServiceModule from "../../worker/auth/service";
import { SESSION_COOKIE_NAME } from "../../worker/auth/security";
import {
  createD1AuthStore,
  type ActiveSessionRecord,
  type AuthStore,
  type SessionRecord,
  type UserRecord,
} from "../../worker/auth/store";
import type { SourceBoardEnvironment } from "../../worker/environment";

const encryptionKey = Buffer.alloc(32, 9).toString("base64");
const lookupKey = Buffer.alloc(32, 7).toString("base64");
const rateLimit = { limit: vi.fn(async () => ({ success: true })) } as unknown as RateLimit;
const env = {
  RATE_LIMIT_AUTH: rateLimit,
  EMAIL_LOOKUP_KEY_V1: lookupKey,
  DATA_ENCRYPTION_KEY_V1: encryptionKey,
} as unknown as SourceBoardEnvironment;

interface SessionContextFields {
  ipEncrypted: string | null;
  ipKeyVersion: string | null;
  userAgent: string | null;
  cfCity: string | null;
  cfRegion: string | null;
  cfCountry: string | null;
  contextUpdatedAt: number | null;
}

type ContextSession = SessionRecord & SessionContextFields;
type ContextActiveSession = ActiveSessionRecord & SessionContextFields;
type SessionAwareService = AuthService & {
  decryptSessionIp(session: SessionRecord): Promise<string | null> | string | null;
};

function attachCf(request: Request, cf: Record<string, unknown>): Request {
  Object.defineProperty(request, "cf", { value: cf, configurable: true });
  return request;
}

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  function prepare(query: string) {
    let bindings: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) {
        bindings = values;
        return statement;
      },
      async first<T>() {
        return (sqlite.prepare(query).get(...(bindings as never[])) ?? null) as T | null;
      },
      async all<T>() {
        return {
          results: sqlite.prepare(query).all(...(bindings as never[])) as T[],
          success: true,
          meta: {},
        } as unknown as D1Result<T>;
      },
      async run<T>() {
        const result = sqlite.prepare(query).run(...(bindings as never[]));
        return {
          results: [],
          success: true,
          meta: { changes: result.changes },
        } as unknown as D1Result<T>;
      },
    };
    return statement;
  }

  return {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
  } as unknown as D1Database;
}

function activeSession(overrides: Partial<ContextActiveSession> = {}): ContextActiveSession {
  return {
    id: "session-1",
    userId: "user-1",
    tokenHash: "token-hash",
    createdAt: 1_000,
    lastUsedAt: 1_000,
    expiresAt: 10_000_000,
    revokedAt: null,
    ipPrefixHash: "prefix-hash",
    userAgentHash: "agent-hash",
    ipEncrypted: null,
    ipKeyVersion: null,
    userAgent: null,
    cfCity: null,
    cfRegion: null,
    cfCountry: null,
    contextUpdatedAt: null,
    username: "session-user",
    status: "ACTIVE",
    emailVerifiedAt: 1_000,
    ...overrides,
  };
}

function loginUser(): UserRecord {
  return {
    id: "user-1",
    username: "SessionUser",
    usernameNormalized: "sessionuser",
    emailLookupHash: "email-hash",
    emailEncrypted: "v1.iv.tag.cipher",
    emailKeyVersion: "v1",
    status: "ACTIVE",
    emailVerifiedAt: 1_000,
    createdAt: 1_000,
    updatedAt: 1_000,
    lastSeenAt: null,
  };
}

describe("Block B encrypted session context", () => {
  it("provides explicit versioned session-IP encryption without changing email crypto", () => {
    const crypto = authCrypto as typeof authCrypto & {
      encryptSessionIp?: (ip: string, secret: string) => string;
      decryptSessionIp?: (encryptedIp: string, secret: string) => string;
    };
    expect(crypto.encryptSessionIp).toBeTypeOf("function");
    expect(crypto.decryptSessionIp).toBeTypeOf("function");
    if (!crypto.encryptSessionIp || !crypto.decryptSessionIp) return;

    const ip = "203.0.113.42";
    const encrypted = crypto.encryptSessionIp(ip, encryptionKey);
    expect(encrypted).not.toContain(ip);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(crypto.decryptSessionIp(encrypted, encryptionKey)).toBe(ip);

    const email = "alice@example.com";
    const encryptedEmail = authCrypto.encryptEmail(email, encryptionKey);
    expect(encryptedEmail.startsWith("v1.")).toBe(true);
    expect(authCrypto.decryptEmail(encryptedEmail, encryptionKey)).toBe(email);
  });

  it("captures trusted request transport context when creating a session", async () => {
    const credentials = await authCrypto.hashPassword("correct horse battery staple");
    const createSession = vi.fn(async () => undefined);
    const store = {
      findUserByEmailLookupHash: vi.fn(async () => loginUser()),
      getCredentials: vi.fn(async () => credentials),
      getLoginFailureState: vi.fn(async () => null),
      clearLoginFailure: vi.fn(async () => undefined),
      recordLoginFailure: vi.fn(async () => undefined),
      createSession,
      writeAuditLog: vi.fn(async () => undefined),
    } as unknown as AuthStore;
    const service = createAuthService({
      store,
      env,
      now: () => 50_000,
      verifyTurnstile: vi.fn(async () => undefined),
    }) as SessionAwareService;
    const request = attachCf(
      new Request("https://sourceboard.test/api/auth/login", {
        method: "POST",
        headers: {
          origin: "https://sourceboard.test",
          "cf-connecting-ip": "203.0.113.42",
          "user-agent": "Mozilla/5.0 Session Context Test",
        },
      }),
      { city: "San José", region: "San José", country: "CR" },
    );

    await service.login(
      { email: "alice@example.com", password: "correct horse battery staple" },
      createAuthContext(request, "session-context-login"),
    );

    expect(createSession).toHaveBeenCalledTimes(1);
    const created = createSession.mock.calls[0]?.[0] as unknown as ContextSession;
    expect(created.ipEncrypted).toBeTypeOf("string");
    expect(created.ipEncrypted).not.toContain("203.0.113.42");
    expect(created.ipKeyVersion).toBe("v1");
    expect(created.userAgent).toBe("Mozilla/5.0 Session Context Test");
    expect(created.cfCity).toBe("San José");
    expect(created.cfRegion).toBe("San José");
    expect(created.cfCountry).toBe("CR");
    expect(created.contextUpdatedAt).toBe(50_000);
    expect(JSON.stringify(created)).not.toContain(encryptionKey);
    expect(service.decryptSessionIp).toBeTypeOf("function");
    expect(await service.decryptSessionIp(created)).toBe("203.0.113.42");
  });

  it("keeps legacy null context rows readable from D1", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          last_used_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          revoked_at INTEGER,
          ip_prefix_hash TEXT,
          user_agent_hash TEXT,
          ip_encrypted TEXT,
          ip_key_version TEXT,
          user_agent TEXT,
          cf_city TEXT,
          cf_region TEXT,
          cf_country TEXT,
          context_updated_at INTEGER
        );
        INSERT INTO sessions (
          id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at,
          ip_prefix_hash, user_agent_hash, ip_encrypted, ip_key_version, user_agent,
          cf_city, cf_region, cf_country, context_updated_at
        ) VALUES (
          'legacy-session', 'legacy-user', 'legacy-token', 1, 1, 10000, NULL,
          NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
        );
      `);
      const sessions = await createD1AuthStore(createSqliteD1(sqlite)).listSessions(
        "legacy-user",
        2,
      );
      expect(sessions).toEqual([
        expect.objectContaining({
          id: "legacy-session",
          ipEncrypted: null,
          ipKeyVersion: null,
          userAgent: null,
          cfCity: null,
          cfRegion: null,
          cfCountry: null,
          contextUpdatedAt: null,
        }),
      ]);
    } finally {
      sqlite.close();
    }
  });

  it("refreshes session activity/context only after the 15-minute context window", async () => {
    const refreshMs = (
      authServiceModule as typeof authServiceModule & {
        SESSION_CONTEXT_REFRESH_MS?: number;
      }
    ).SESSION_CONTEXT_REFRESH_MS;
    expect(refreshMs).toBe(15 * 60 * 1000);

    const touchSession = vi.fn(async () => undefined);
    const findActiveSessionByTokenHash = vi.fn<() => Promise<ContextActiveSession | null>>();
    const store = {
      findActiveSessionByTokenHash,
      touchSession,
    } as unknown as AuthStore;
    const service = createAuthService({ store, env });
    const at = 2_000_000;
    const request = attachCf(
      new Request("https://sourceboard.test/api/auth/session", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=raw-session-token`,
          "cf-connecting-ip": "198.51.100.23",
          "user-agent": "Mozilla/5.0 Refreshed Session",
        },
      }),
      { city: "Puntarenas", region: "Puntarenas", country: "CR" },
    );

    findActiveSessionByTokenHash.mockResolvedValueOnce(
      activeSession({
        lastUsedAt: at - 16 * 60 * 1000,
        contextUpdatedAt: at - 16 * 60 * 1000,
      }),
    );
    await service.getSession(request, at);
    expect(touchSession).toHaveBeenCalledWith(
      "session-1",
      at,
      expect.objectContaining({
        ipEncrypted: expect.any(String),
        ipKeyVersion: "v1",
        userAgent: "Mozilla/5.0 Refreshed Session",
        cfCity: "Puntarenas",
        cfRegion: "Puntarenas",
        cfCountry: "CR",
        contextUpdatedAt: at,
      }),
    );

    touchSession.mockClear();
    findActiveSessionByTokenHash.mockResolvedValueOnce(
      activeSession({
        lastUsedAt: at - 6 * 60 * 1000,
        contextUpdatedAt: at - 60 * 1000,
      }),
    );
    await service.getSession(request, at);
    expect(touchSession).not.toHaveBeenCalled();
  });
});
