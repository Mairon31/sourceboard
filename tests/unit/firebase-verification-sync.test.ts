import { describe, expect, it, vi } from "vitest";
import { createAuthService, type AuthServiceContext } from "../../worker/auth/service";
import type { FirebaseAuthClient } from "../../worker/auth/firebase";
import type { SourceBoardEnvironment } from "../../worker/environment";
import type { AuthStore, UserRecord } from "../../worker/auth/store";

const environment: SourceBoardEnvironment = {
  EMAIL_LOOKUP_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
};

function context(): AuthServiceContext {
  return {
    request: new Request("https://srcboard.me/api/auth/email/verify", { method: "POST" }),
    requestId: "firebase-verification-sync",
    security: {
      ipAddress: "203.0.113.10",
      ipPrefixHash: "hashed-ip",
      userAgentHash: "hashed-agent",
    },
  };
}

function pendingUser(): UserRecord {
  return {
    id: "firebase-user",
    username: "FirebaseUser",
    usernameNormalized: "firebaseuser",
    emailLookupHash: "lookup-hash",
    emailEncrypted: "encrypted-email",
    emailKeyVersion: "v1",
    status: "PENDING_VERIFICATION",
    emailVerifiedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    lastSeenAt: null,
  };
}

describe("Firebase email verification synchronization", () => {
  it("promotes the matching D1 account after Firebase accepts the action code", async () => {
    const user = pendingUser();
    const store = {
      findUserByEmailLookupHash: vi.fn(async () => user),
      markEmailVerified: vi.fn(async () => undefined),
      writeAuditLog: vi.fn(async () => undefined),
    } as unknown as AuthStore;
    const firebase = {
      confirmEmailVerification: vi.fn(async () => ({
        localId: user.id,
        email: "verified@example.com",
      })),
    } as unknown as FirebaseAuthClient;
    const service = createAuthService({ store, env: environment, firebase, now: () => 5000 });

    await expect(service.verifyEmail("firebase-oob-code", context())).resolves.toEqual({
      verified: true,
    });
    expect(store.markEmailVerified).toHaveBeenCalledWith(user.id, 5000);
    expect(store.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: user.id,
        action: "auth.email_verified",
        targetId: user.id,
      }),
    );
  });

  it("does not activate a different SourceBoard account when Firebase ids disagree", async () => {
    const store = {
      findUserByEmailLookupHash: vi.fn(async () => pendingUser()),
      markEmailVerified: vi.fn(async () => undefined),
      writeAuditLog: vi.fn(async () => undefined),
    } as unknown as AuthStore;
    const firebase = {
      confirmEmailVerification: vi.fn(async () => ({
        localId: "different-firebase-user",
        email: "verified@example.com",
      })),
    } as unknown as FirebaseAuthClient;
    const service = createAuthService({ store, env: environment, firebase, now: () => 5000 });

    await expect(service.verifyEmail("firebase-oob-code", context())).rejects.toMatchObject({
      code: "VERIFICATION_TOKEN_INVALID",
    });
    expect(store.markEmailVerified).not.toHaveBeenCalled();
  });
});
