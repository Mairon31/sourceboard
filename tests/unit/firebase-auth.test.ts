import { describe, expect, it, vi } from "vitest";
import { createFirebaseAuthClient, FirebaseAuthError } from "../../worker/auth/firebase";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Firebase Authentication REST client", () => {
  it("creates accounts and requests Firebase verification email delivery", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          localId: "firebase-user",
          email: "alice@example.com",
          idToken: "id-token",
          refreshToken: "refresh-token",
        }),
      )
      .mockResolvedValueOnce(response({ email: "alice@example.com" }));
    const client = createFirebaseAuthClient({ apiKey: "firebase-api-key", fetcher });

    await expect(
      client.createUser({ email: "alice@example.com", password: "correct horse battery staple" }),
    ).resolves.toMatchObject({ localId: "firebase-user", idToken: "id-token" });
    await expect(client.sendEmailVerification("id-token")).resolves.toBeUndefined();

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=firebase-api-key",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=firebase-api-key",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("maps provider errors without exposing Firebase response details", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ error: { message: "EMAIL_EXISTS: internal detail" } }, 400));
    const client = createFirebaseAuthClient({ apiKey: "firebase-api-key", fetcher });

    await expect(
      client.signInWithPassword({ email: "alice@example.com", password: "wrong" }),
    ).rejects.toMatchObject({ code: "EMAIL_EXISTS", status: 400 });
    await expect(
      client.signInWithPassword({ email: "alice@example.com", password: "wrong" }),
    ).rejects.not.toThrow("internal detail");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("supports the verification and password-reset action-code endpoints", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ localId: "firebase-user", email: "alice@example.com" }))
      .mockResolvedValueOnce(
        response({
          localId: "firebase-user",
          email: "alice@example.com",
          requestType: "PASSWORD_RESET",
        }),
      )
      .mockResolvedValueOnce(response({ email: "alice@example.com" }));
    const client = createFirebaseAuthClient({ apiKey: "firebase-api-key", fetcher });

    await expect(client.confirmEmailVerification("verify-code")).resolves.toEqual({
      localId: "firebase-user",
      email: "alice@example.com",
    });
    await expect(client.getPasswordResetInfo("reset-code")).resolves.toMatchObject({
      email: "alice@example.com",
    });
    await expect(
      client.confirmPasswordReset("reset-code", "new correct horse battery staple"),
    ).resolves.toEqual({ email: "alice@example.com" });

    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("rejects an unconfigured client before making a network request", async () => {
    expect(() => createFirebaseAuthClient({ apiKey: "" })).toThrow(FirebaseAuthError);
  });
});
