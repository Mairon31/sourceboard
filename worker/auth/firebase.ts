export interface FirebasePasswordAuthResult {
  localId: string;
  email: string;
  idToken: string;
  refreshToken: string;
}

export interface FirebaseAccountInfo {
  localId: string;
  email: string;
  emailVerified: boolean;
  disabled: boolean;
}

export interface FirebaseActionCodeInfo {
  localId?: string;
  email: string;
}

export interface FirebaseAuthClient {
  createUser(input: { email: string; password: string }): Promise<FirebasePasswordAuthResult>;
  signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<FirebasePasswordAuthResult>;
  getAccountInfo(idToken: string): Promise<FirebaseAccountInfo>;
  sendEmailVerification(idToken: string, continueUrl?: string): Promise<void>;
  sendPasswordReset(email: string, continueUrl?: string): Promise<void>;
  confirmEmailVerification(oobCode: string): Promise<FirebaseActionCodeInfo>;
  getPasswordResetInfo(oobCode: string): Promise<FirebaseActionCodeInfo>;
  confirmPasswordReset(oobCode: string, password: string): Promise<FirebaseActionCodeInfo>;
  updatePassword(idToken: string, password: string): Promise<void>;
  deleteUser(idToken: string): Promise<void>;
}

export class FirebaseAuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = "FirebaseAuthError";
  }
}

export function isFirebaseAuthError(error: unknown): error is FirebaseAuthError {
  return error instanceof FirebaseAuthError;
}

interface FirebaseAuthClientOptions {
  apiKey: string;
  fetcher?: typeof fetch;
}

interface FirebaseErrorResponse {
  error?: { message?: unknown };
}

interface FirebaseAccountResponse {
  users?: Array<{
    localId?: unknown;
    email?: unknown;
    emailVerified?: unknown;
    disabled?: unknown;
  }>;
}

interface FirebaseActionResponse {
  localId?: unknown;
  email?: unknown;
}

function requireString(value: unknown, code: string): string {
  if (typeof value !== "string" || !value) {
    throw new FirebaseAuthError(503, code);
  }
  return value;
}

function mapProviderCode(body: FirebaseErrorResponse): string {
  const message = body.error?.message;
  if (typeof message !== "string") return "FIREBASE_REQUEST_FAILED";
  return message.split(":", 1)[0]?.trim() || "FIREBASE_REQUEST_FAILED";
}

function actionCodeInfo(body: FirebaseActionResponse): FirebaseActionCodeInfo {
  return {
    localId: typeof body.localId === "string" ? body.localId : undefined,
    email: requireString(body.email, "FIREBASE_INVALID_RESPONSE"),
  };
}

export function createFirebaseAuthClient({ apiKey, fetcher = fetch }: FirebaseAuthClientOptions) {
  const normalizedApiKey = apiKey.trim();
  if (!normalizedApiKey) {
    throw new FirebaseAuthError(503, "FIREBASE_NOT_CONFIGURED");
  }

  async function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
      response = await fetcher(
        `https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(normalizedApiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
    } catch {
      throw new FirebaseAuthError(503, "FIREBASE_UNAVAILABLE");
    }

    const payload = (await response.json().catch(() => ({}))) as FirebaseErrorResponse & T;
    if (!response.ok) {
      throw new FirebaseAuthError(400, mapProviderCode(payload));
    }
    return payload as T;
  }

  async function passwordAuth(
    path: string,
    input: { email: string; password: string },
  ): Promise<FirebasePasswordAuthResult> {
    const payload = await request<FirebasePasswordAuthResult>(path, {
      email: input.email,
      password: input.password,
      returnSecureToken: true,
    });
    return {
      localId: requireString(payload.localId, "FIREBASE_INVALID_RESPONSE"),
      email: requireString(payload.email, "FIREBASE_INVALID_RESPONSE"),
      idToken: requireString(payload.idToken, "FIREBASE_INVALID_RESPONSE"),
      refreshToken: requireString(payload.refreshToken, "FIREBASE_INVALID_RESPONSE"),
    };
  }

  return {
    createUser(input) {
      return passwordAuth("accounts:signUp", input);
    },

    signInWithPassword(input) {
      return passwordAuth("accounts:signInWithPassword", input);
    },

    async getAccountInfo(idToken) {
      const payload = await request<FirebaseAccountResponse>("accounts:lookup", { idToken });
      const account = payload.users?.[0];
      return {
        localId: requireString(account?.localId, "FIREBASE_INVALID_RESPONSE"),
        email: requireString(account?.email, "FIREBASE_INVALID_RESPONSE"),
        emailVerified: account?.emailVerified === true,
        disabled: account?.disabled === true,
      };
    },

    async sendEmailVerification(idToken, continueUrl) {
      await request("accounts:sendOobCode", {
        requestType: "VERIFY_EMAIL",
        idToken,
        ...(continueUrl ? { continueUrl } : {}),
      });
    },

    async sendPasswordReset(email, continueUrl) {
      await request("accounts:sendOobCode", {
        requestType: "PASSWORD_RESET",
        email,
        ...(continueUrl ? { continueUrl } : {}),
      });
    },

    async confirmEmailVerification(oobCode) {
      return actionCodeInfo(await request<FirebaseActionResponse>("accounts:update", { oobCode }));
    },

    async getPasswordResetInfo(oobCode) {
      return actionCodeInfo(
        await request<FirebaseActionResponse>("accounts:resetPassword", { oobCode }),
      );
    },

    async confirmPasswordReset(oobCode, password) {
      return actionCodeInfo(
        await request<FirebaseActionResponse>("accounts:update", {
          oobCode,
          password,
          returnSecureToken: true,
        }),
      );
    },

    async updatePassword(idToken, password) {
      await request("accounts:update", { idToken, password, returnSecureToken: true });
    },

    async deleteUser(idToken) {
      await request("accounts:delete", { idToken });
    },
  } satisfies FirebaseAuthClient;
}
