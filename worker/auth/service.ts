import { Buffer } from "node:buffer";
import {
  createEmailLookupHash,
  createIdentifier,
  createOpaqueToken,
  decryptEmail,
  encryptEmail,
  hashOpaqueToken,
  hashPassword,
  needsPasswordRehash,
  normalizeEmail,
  normalizeUsername,
  verifyPassword,
} from "./crypto";
import { enforceAuthRateLimit, requireTurnstile, sendTransactionalEmail } from "./bindings";
import { AuthError } from "./errors";
import {
  createFirebaseAuthClient,
  isFirebaseAuthError,
  type FirebaseAccountInfo,
  type FirebaseAuthClient,
  type FirebasePasswordAuthResult,
} from "./firebase";
import { assertCanChangeRole, type AuthorizationSnapshot, type RoleSlug } from "./rbac";
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  getRequestSecurityContext,
  getSessionToken,
  serializeCookie,
  type RequestSecurityContext,
} from "./security";
import type { SourceBoardEnvironment } from "../environment";
import type {
  ActiveSessionRecord,
  AuthStore,
  SessionRecord,
  SessionSummary,
  UserRecord,
} from "./store";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_TURNSTILE_FAILURE_THRESHOLD = 3;

export interface AuthServiceContext {
  request: Request;
  requestId: string;
  security: RequestSecurityContext;
}

export interface AuthCookie {
  name: string;
  value: string;
  maxAge: number;
  httpOnly: boolean;
}

export interface PublicAuthUser {
  id: string;
  username: string;
}

export interface AuthServiceDependencies {
  store: AuthStore;
  env: SourceBoardEnvironment;
  firebase?: FirebaseAuthClient;
  now?: () => number;
  verifyTurnstile?: (token: string | undefined) => Promise<void>;
  sendEmail?: (message: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) => Promise<void>;
}

export interface AuthenticatedSession {
  session: ActiveSessionRecord;
  user: PublicAuthUser;
}

export interface AuthService {
  register(
    input: {
      username: string;
      email: string;
      password: string;
      turnstileToken?: string;
    },
    context: AuthServiceContext,
  ): Promise<{ verificationRequired: boolean }>;
  login(
    input: {
      email: string;
      password: string;
      turnstileToken?: string;
    },
    context: AuthServiceContext,
  ): Promise<{
    user: PublicAuthUser;
    sessionExpiresAt: number;
    cookies: AuthCookie[];
  }>;
  loginWithFirebaseToken(
    input: { idToken: string },
    context: AuthServiceContext,
  ): Promise<{
    user: PublicAuthUser;
    sessionExpiresAt: number;
    cookies: AuthCookie[];
  }>;
  getSession(request: Request, now?: number): Promise<AuthenticatedSession | null>;
  logout(context: AuthServiceContext): Promise<{ cookies: AuthCookie[] }>;
  logoutAll(context: AuthServiceContext): Promise<{ user: PublicAuthUser; cookies: AuthCookie[] }>;
  verifyEmail(token: string, context: AuthServiceContext): Promise<{ verified: true }>;
  forgotPassword(
    input: { email: string; turnstileToken?: string },
    context: AuthServiceContext,
  ): Promise<{ accepted: true }>;
  resetPassword(
    input: { token: string; password: string; turnstileToken?: string },
    context: AuthServiceContext,
  ): Promise<{ reset: true; cookies: AuthCookie[] }>;
  changePassword(
    input: { currentPassword: string; newPassword: string },
    context: AuthServiceContext,
  ): Promise<{ changed: true; cookies: AuthCookie[] }>;
  listSessions(context: AuthServiceContext): Promise<SessionSummary[]>;
  revokeSession(sessionId: string, context: AuthServiceContext): Promise<void>;
  changeRole(
    input: {
      targetUserId: string;
      role: RoleSlug;
      operation: "assign" | "remove";
      reason: string;
    },
    context: AuthServiceContext,
  ): Promise<void>;
  getAuthorization(context: AuthServiceContext): Promise<AuthorizationSnapshot>;
}

function requireSecret(
  env: SourceBoardEnvironment,
  name: "EMAIL_LOOKUP_KEY_V1" | "DATA_ENCRYPTION_KEY_V1",
): string {
  const value = env[name];
  if (!value) {
    throw new AuthError(
      503,
      "AUTH_INFRASTRUCTURE_UNAVAILABLE",
      "Authentication is temporarily unavailable.",
    );
  }
  return value;
}

function requireEmailDelivery(env: SourceBoardEnvironment): void {
  if (!env.EMAIL || !env.EMAIL_FROM) {
    throw new AuthError(
      503,
      "AUTH_INFRASTRUCTURE_UNAVAILABLE",
      "Authentication is temporarily unavailable.",
    );
  }
}

function configuredFirebaseAuth(env: SourceBoardEnvironment): FirebaseAuthClient | null {
  if (!env.FIREBASE_API_KEY || !env.FIREBASE_PROJECT_ID) return null;
  return createFirebaseAuthClient({ apiKey: env.FIREBASE_API_KEY });
}

function providerUnavailable(error: unknown): boolean {
  return isFirebaseAuthError(error) && error.status >= 500;
}

function authenticationError(error: unknown): AuthError {
  if (providerUnavailable(error)) {
    return new AuthError(
      503,
      "AUTH_INFRASTRUCTURE_UNAVAILABLE",
      "Authentication is temporarily unavailable.",
    );
  }
  return new AuthError(401, "AUTHENTICATION_FAILED", "Email or password is incorrect.");
}

function googleAuthenticationError(error: unknown): AuthError {
  if (providerUnavailable(error)) {
    return new AuthError(
      503,
      "AUTH_INFRASTRUCTURE_UNAVAILABLE",
      "Authentication is temporarily unavailable.",
    );
  }
  return new AuthError(
    401,
    "AUTHENTICATION_FAILED",
    "Google sign-in could not be completed. Try again.",
  );
}

function assertGoogleAccount(account: FirebaseAccountInfo): void {
  if (
    account.disabled ||
    !account.emailVerified ||
    !account.providerUserInfo?.some((provider) => provider.providerId === "google.com")
  ) {
    throw googleAuthenticationError(new Error("GOOGLE_PROVIDER_REQUIRED"));
  }
}

function createGoogleUsername(
  account: FirebaseAccountInfo,
  email: string,
): {
  username: string;
  usernameNormalized: string;
} {
  const base = (account.displayName ?? email.split("@", 1)[0] ?? "SourceUser")
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 23);
  const suffix = account.localId.replace(/[^A-Za-z0-9_]/g, "").slice(0, 8) || "account";
  const username = `${base || "SourceUser"}_${suffix}`.slice(0, 32);
  return { username, usernameNormalized: normalizeUsername(username) };
}

function createGoogleUser(
  account: FirebaseAccountInfo,
  email: string,
  emailLookupHash: string,
  encryptionKey: string,
  createdAt: number,
): UserRecord {
  const { username, usernameNormalized } = createGoogleUsername(account, email);
  return {
    id: account.localId,
    username,
    usernameNormalized,
    emailLookupHash,
    emailEncrypted: encryptEmail(email, encryptionKey),
    emailKeyVersion: "v1",
    status: "ACTIVE",
    emailVerifiedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
    lastSeenAt: null,
  };
}

async function resolveGoogleUser(
  store: AuthStore,
  account: FirebaseAccountInfo,
  email: string,
  emailLookupHash: string,
  encryptionKey: string,
  at: number,
): Promise<UserRecord> {
  const [userByEmail, userById] = await Promise.all([
    store.findUserByEmailLookupHash(emailLookupHash),
    store.getUserById(account.localId),
  ]);
  if (userByEmail && userByEmail.id !== account.localId) {
    throw googleAuthenticationError(new Error("EMAIL_PROFILE_MISMATCH"));
  }

  const user = userById ?? userByEmail;
  if (!user) {
    const created = createGoogleUser(account, email, emailLookupHash, encryptionKey, at);
    const usernameOwner = await store.findUserByUsernameNormalized(created.usernameNormalized);
    if (usernameOwner) {
      throw googleAuthenticationError(new Error("USERNAME_COLLISION"));
    }
    try {
      await store.createExternalUser({ user: created });
    } catch (error) {
      throw googleAuthenticationError(error);
    }
    return created;
  }

  if (user.status === "SUSPENDED" || user.status === "BANNED" || user.status === "DELETED") {
    throw googleAuthenticationError(new Error("USER_UNAVAILABLE"));
  }
  if (user.status !== "ACTIVE" || !user.emailVerifiedAt) {
    await store.markEmailVerified(user.id, at);
    return { ...user, status: "ACTIVE", emailVerifiedAt: at };
  }
  return user;
}

function registrationError(error: unknown): AuthError {
  if (isFirebaseAuthError(error) && error.code === "EMAIL_EXISTS") {
    return new AuthError(
      409,
      "ACCOUNT_UNAVAILABLE",
      "Unable to create an account with those details.",
    );
  }
  if (isFirebaseAuthError(error) && error.code === "INVALID_EMAIL") {
    return new AuthError(400, "INVALID_EMAIL", "Enter a valid email address.");
  }
  if (providerUnavailable(error)) {
    return new AuthError(
      503,
      "AUTH_INFRASTRUCTURE_UNAVAILABLE",
      "Authentication is temporarily unavailable.",
    );
  }
  return new AuthError(
    503,
    "AUTH_INFRASTRUCTURE_UNAVAILABLE",
    "Authentication is temporarily unavailable.",
  );
}

function actionCodeError(
  error: unknown,
  code: "VERIFICATION_TOKEN_INVALID" | "RESET_TOKEN_INVALID",
) {
  if (providerUnavailable(error)) {
    return new AuthError(
      503,
      "AUTH_INFRASTRUCTURE_UNAVAILABLE",
      "Authentication is temporarily unavailable.",
    );
  }
  return new AuthError(
    400,
    code,
    code === "RESET_TOKEN_INVALID"
      ? "The reset link is invalid or expired."
      : "The verification link is invalid or expired.",
  );
}

function toPublicUser(user: Pick<UserRecord, "id" | "username">): PublicAuthUser {
  return { id: user.id, username: user.username };
}

function createSessionCookies(rawSessionToken: string, csrfToken: string): AuthCookie[] {
  return [
    {
      name: SESSION_COOKIE_NAME,
      value: rawSessionToken,
      maxAge: SESSION_MAX_AGE_SECONDS,
      httpOnly: true,
    },
    {
      name: CSRF_COOKIE_NAME,
      value: csrfToken,
      maxAge: SESSION_MAX_AGE_SECONDS,
      httpOnly: false,
    },
  ];
}

function clearSessionCookies(): AuthCookie[] {
  return [
    { name: SESSION_COOKIE_NAME, value: "", maxAge: 0, httpOnly: true },
    { name: CSRF_COOKIE_NAME, value: "", maxAge: 0, httpOnly: false },
  ];
}

function createAuditInput(
  context: AuthServiceContext,
  input: {
    actorUserId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    reason?: string | null;
    metadata?: Record<string, string | number | boolean>;
  },
) {
  return {
    id: createIdentifier(),
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason ?? null,
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    requestId: context.requestId,
    ipPrefixHash: context.security.ipPrefixHash,
    createdAt: Date.now(),
  };
}

function validatePassword(password: string): void {
  if (password.length < 12 || password.length > 256) {
    throw new AuthError(
      400,
      "INVALID_PASSWORD",
      "Choose a password between 12 and 256 characters.",
    );
  }
}

function validateRegistrationInput(username: string, email: string, password: string): void {
  if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) {
    throw new AuthError(
      400,
      "INVALID_USERNAME",
      "Username must contain 3–32 letters, numbers or underscores.",
    );
  }

  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) {
    throw new AuthError(400, "INVALID_EMAIL", "Enter a valid email address.");
  }
  validatePassword(password);
}

function validationContext(context: AuthServiceContext): AuthServiceContext {
  return {
    ...context,
    security: context.security ?? getRequestSecurityContext(context.request),
    request: context.request,
    requestId: context.requestId,
  };
}

async function createOrRecoverFirebaseRegistration(
  input: { email: string; password: string },
  activeFirebase: FirebaseAuthClient,
): Promise<{
  remote: FirebasePasswordAuthResult;
  account: FirebaseAccountInfo;
  cleanupRemote: boolean;
}> {
  try {
    const remote = await activeFirebase.createUser({
      email: normalizeEmail(input.email),
      password: input.password,
    });
    return {
      remote,
      account: {
        localId: remote.localId,
        email: remote.email,
        emailVerified: false,
        disabled: false,
      },
      cleanupRemote: true,
    };
  } catch (error) {
    if (!isFirebaseAuthError(error) || error.code !== "EMAIL_EXISTS") {
      throw registrationError(error);
    }
    try {
      const remote = await activeFirebase.signInWithPassword({
        email: normalizeEmail(input.email),
        password: input.password,
      });
      const account = await activeFirebase.getAccountInfo(remote.idToken);
      if (
        account.disabled ||
        account.localId !== remote.localId ||
        normalizeEmail(account.email) !== normalizeEmail(input.email)
      ) {
        throw registrationError(error);
      }
      return { remote, account, cleanupRemote: false };
    } catch (recoveryError) {
      if (recoveryError instanceof AuthError) throw recoveryError;
      throw providerUnavailable(recoveryError)
        ? registrationError(recoveryError)
        : registrationError(error);
    }
  }
}

export function createAuthService(dependencies: AuthServiceDependencies): AuthService {
  const now = dependencies.now ?? (() => Date.now());
  const firebase = dependencies.firebase ?? configuredFirebaseAuth(dependencies.env);
  const verifyTurnstile =
    dependencies.verifyTurnstile ??
    ((token: string | undefined) => requireTurnstile(dependencies.env, token));
  const sendEmail =
    dependencies.sendEmail ?? ((message) => sendTransactionalEmail(dependencies.env, message));

  async function currentSession(
    context: AuthServiceContext,
    required = true,
  ): Promise<AuthenticatedSession | null> {
    const rawToken = getSessionToken(context.request);
    if (!rawToken) {
      if (required) {
        throw new AuthError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
      }
      return null;
    }

    const current = await dependencies.store.findActiveSessionByTokenHash(
      hashOpaqueToken(rawToken),
      now(),
    );
    if (!current || current.status !== "ACTIVE" || !current.emailVerifiedAt) {
      if (required) {
        throw new AuthError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
      }
      return null;
    }

    await dependencies.store.touchSession(current.id, now());
    return { session: current, user: { id: current.userId, username: current.username } };
  }

  async function prepareLogin(
    input: { email: string; password: string },
    context: AuthServiceContext,
  ) {
    const requestContext = validationContext(context);
    if (!/^\S+@\S+\.\S+$/.test(input.email) || input.email.length > 320) {
      throw new AuthError(401, "AUTHENTICATION_FAILED", "Email or password is incorrect.");
    }
    validatePassword(input.password);

    const emailLookupKey = requireSecret(dependencies.env, "EMAIL_LOOKUP_KEY_V1");
    const normalizedEmail = normalizeEmail(input.email);
    return {
      requestContext,
      emailLookupHash: createEmailLookupHash(normalizedEmail, emailLookupKey),
    };
  }

  async function enforceLoginProtection(
    emailLookupHash: string,
    requestContext: AuthServiceContext,
    turnstileToken: string | undefined,
  ): Promise<void> {
    await enforceAuthRateLimit(
      dependencies.env.RATE_LIMIT_AUTH,
      `login:ip:${requestContext.security.ipAddress}`,
    );
    await enforceAuthRateLimit(
      dependencies.env.RATE_LIMIT_AUTH,
      `login:account:${emailLookupHash}`,
    );

    const failureState = await dependencies.store.getLoginFailureState(emailLookupHash);
    const failureWindowActive =
      failureState && failureState.updatedAt > now() - LOGIN_FAILURE_WINDOW_MS;
    if (failureWindowActive && failureState.failures >= LOGIN_TURNSTILE_FAILURE_THRESHOLD) {
      await verifyTurnstile(turnstileToken);
    }
  }

  // fallow-ignore-next-line complexity -- provider and legacy credential paths must preserve identical security checks.
  async function authenticateLogin(
    input: { email: string; password: string },
    emailLookupHash: string,
  ) {
    const user = await dependencies.store.findUserByEmailLookupHash(emailLookupHash);
    const credentials = user ? await dependencies.store.getCredentials(user.id) : null;
    if (firebase && !credentials) {
      try {
        const remote = await firebase.signInWithPassword(input);
        const account = await firebase.getAccountInfo(remote.idToken);
        if (!user || remote.localId !== user.id || account.disabled || !account.emailVerified) {
          throw new AuthError(401, "AUTHENTICATION_FAILED", "Email or password is incorrect.");
        }
        return { user, credentials: null, firebaseResult: remote };
      } catch (error) {
        await dependencies.store.recordLoginFailure(
          emailLookupHash,
          now(),
          LOGIN_FAILURE_WINDOW_MS,
        );
        if (error instanceof AuthError) throw error;
        throw authenticationError(error);
      }
    }

    const passwordValid = credentials
      ? await verifyPassword(input.password, credentials)
      : await hashPassword("sourceboard-invalid-login-dummy", Buffer.alloc(16, 0)).then(
          () => false,
        );

    if (!user || !credentials || !passwordValid) {
      await dependencies.store.recordLoginFailure(emailLookupHash, now(), LOGIN_FAILURE_WINDOW_MS);
      throw new AuthError(401, "AUTHENTICATION_FAILED", "Email or password is incorrect.");
    }
    return { user, credentials };
  }

  function assertActiveLoginUser(user: UserRecord): void {
    if (user.status !== "ACTIVE" || !user.emailVerifiedAt) {
      throw new AuthError(401, "AUTHENTICATION_FAILED", "Email or password is incorrect.");
    }
  }

  async function refreshPasswordIfNeeded(
    user: UserRecord,
    password: string,
    credentials: Awaited<ReturnType<typeof authenticateLogin>>["credentials"],
  ): Promise<void> {
    if (!credentials) return;
    if (needsPasswordRehash(credentials)) {
      await dependencies.store.updatePasswordRecord(user.id, await hashPassword(password), now());
    }
  }

  async function revokePreviousLoginSession(
    requestContext: AuthServiceContext,
    userId: string,
  ): Promise<void> {
    const previous = await currentSession(requestContext, false);
    if (previous) {
      await dependencies.store.revokeSession(previous.session.id, userId, now());
    }
  }

  async function createLoginSession(user: UserRecord, requestContext: AuthServiceContext) {
    const rawSessionToken = createOpaqueToken();
    const csrfToken = createOpaqueToken();
    const createdAt = now();
    const expiresAt = createdAt + SESSION_MAX_AGE_SECONDS * 1000;
    await dependencies.store.createSession({
      id: createIdentifier(),
      userId: user.id,
      tokenHash: hashOpaqueToken(rawSessionToken),
      createdAt,
      lastUsedAt: createdAt,
      expiresAt,
      revokedAt: null,
      ipPrefixHash: requestContext.security.ipPrefixHash,
      userAgentHash: requestContext.security.userAgentHash,
    });
    return { expiresAt, rawSessionToken, csrfToken };
  }

  async function writeAudit(
    context: AuthServiceContext,
    input: Parameters<typeof createAuditInput>[1],
  ): Promise<void> {
    await dependencies.store.writeAuditLog({
      ...createAuditInput(context, input),
      createdAt: now(),
    });
  }

  async function registerWithFirebase(
    input: { username: string; email: string; password: string },
    requestContext: AuthServiceContext,
    emailLookupHash: string,
    encryptionKey: string,
    usernameNormalized: string,
  ): Promise<{ verificationRequired: boolean }> {
    const registration = await createOrRecoverFirebaseRegistration(input, firebase!);
    return persistFirebaseRegistration(
      input,
      requestContext,
      emailLookupHash,
      encryptionKey,
      usernameNormalized,
      registration.remote,
      registration.account,
      registration.cleanupRemote,
    );
  }

  async function persistFirebaseRegistration(
    input: { username: string; email: string; password: string },
    requestContext: AuthServiceContext,
    emailLookupHash: string,
    encryptionKey: string,
    usernameNormalized: string,
    remote: FirebasePasswordAuthResult,
    account: FirebaseAccountInfo,
    cleanupRemote: boolean,
  ): Promise<{ verificationRequired: boolean }> {
    const createdAt = now();
    const user: UserRecord = {
      id: remote.localId,
      username: input.username.trim(),
      usernameNormalized,
      emailLookupHash,
      emailEncrypted: encryptEmail(normalizeEmail(input.email), encryptionKey),
      emailKeyVersion: "v1",
      status: account.emailVerified ? "ACTIVE" : "PENDING_VERIFICATION",
      emailVerifiedAt: account.emailVerified ? createdAt : null,
      createdAt,
      updatedAt: createdAt,
      lastSeenAt: null,
    };

    let persisted = false;
    try {
      await dependencies.store.createExternalUser({ user });
      persisted = true;
      if (!account.emailVerified) {
        await firebase!.sendEmailVerification(
          remote.idToken,
          new URL("/verify-email", requestContext.request.url).toString(),
        );
      }
    } catch (error) {
      if (persisted) {
        try {
          await dependencies.store.deletePendingUser(user.id);
        } catch {
          // Keep the public response stable even if cleanup is unavailable.
        }
      }
      if (cleanupRemote) {
        try {
          await firebase!.deleteUser(remote.idToken);
        } catch {
          // Firebase cleanup is best effort; no credential is ever stored locally.
        }
      }
      throw registrationError(error);
    }

    await writeAudit(requestContext, {
      actorUserId: user.id,
      action: "auth.register",
      targetType: "user",
      targetId: user.id,
    });
    return { verificationRequired: !account.emailVerified };
  }

  async function register(
    input: { username: string; email: string; password: string; turnstileToken?: string },
    context: AuthServiceContext,
  ): Promise<{ verificationRequired: boolean }> {
    const requestContext = validationContext(context);
    validateRegistrationInput(input.username, input.email, input.password);
    await enforceAuthRateLimit(
      dependencies.env.RATE_LIMIT_AUTH,
      `register:ip:${requestContext.security.ipAddress}`,
    );
    await verifyTurnstile(input.turnstileToken);
    if (!firebase) requireEmailDelivery(dependencies.env);

    const normalizedEmail = normalizeEmail(input.email);
    const emailLookupKey = requireSecret(dependencies.env, "EMAIL_LOOKUP_KEY_V1");
    const encryptionKey = requireSecret(dependencies.env, "DATA_ENCRYPTION_KEY_V1");
    const emailLookupHash = createEmailLookupHash(normalizedEmail, emailLookupKey);
    const usernameNormalized = normalizeUsername(input.username);

    const [existingEmail, existingUsername] = await Promise.all([
      dependencies.store.findUserByEmailLookupHash(emailLookupHash),
      dependencies.store.findUserByUsernameNormalized(usernameNormalized),
    ]);
    if (existingEmail || existingUsername) {
      throw new AuthError(
        409,
        "ACCOUNT_UNAVAILABLE",
        "Unable to create an account with those details.",
      );
    }

    if (firebase) {
      return registerWithFirebase(
        input,
        requestContext,
        emailLookupHash,
        encryptionKey,
        usernameNormalized,
      );
    }

    const createdAt = now();
    const verificationToken = createOpaqueToken();
    const user: UserRecord = {
      id: createIdentifier(),
      username: input.username.trim(),
      usernameNormalized,
      emailLookupHash,
      emailEncrypted: encryptEmail(normalizedEmail, encryptionKey),
      emailKeyVersion: "v1",
      status: "PENDING_VERIFICATION",
      emailVerifiedAt: null,
      createdAt,
      updatedAt: createdAt,
      lastSeenAt: null,
    };

    await dependencies.store.createUser({
      user,
      password: await hashPassword(input.password),
      verificationToken: {
        id: createIdentifier(),
        tokenHash: hashOpaqueToken(verificationToken),
        createdAt,
        expiresAt: createdAt + EMAIL_VERIFICATION_TTL_MS,
      },
    });

    const verificationUrl = new URL(
      `/verify-email?token=${encodeURIComponent(verificationToken)}`,
      requestContext.request.url,
    ).toString();
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Verify your SourceBoard email",
        text: `Verify your SourceBoard email by opening this link:\n\n${verificationUrl}\n\nThis link expires in 24 hours.`,
      });
    } catch {
      try {
        await dependencies.store.deletePendingUser(user.id);
      } catch {
        // Keep the public response stable even if cleanup itself is unavailable.
      }
      throw new AuthError(
        503,
        "EMAIL_DELIVERY_UNAVAILABLE",
        "Email delivery is temporarily unavailable. Try again shortly.",
      );
    }
    await writeAudit(requestContext, {
      actorUserId: user.id,
      action: "auth.register",
      targetType: "user",
      targetId: user.id,
    });

    return { verificationRequired: true };
  }

  async function login(
    input: { email: string; password: string; turnstileToken?: string },
    context: AuthServiceContext,
  ): Promise<{ user: PublicAuthUser; sessionExpiresAt: number; cookies: AuthCookie[] }> {
    const preparation = await prepareLogin(input, context);
    await enforceLoginProtection(
      preparation.emailLookupHash,
      preparation.requestContext,
      input.turnstileToken,
    );
    const { user, credentials } = await authenticateLogin(input, preparation.emailLookupHash);
    assertActiveLoginUser(user);
    await dependencies.store.clearLoginFailure(preparation.emailLookupHash);
    await refreshPasswordIfNeeded(user, input.password, credentials);
    await revokePreviousLoginSession(preparation.requestContext, user.id);
    const session = await createLoginSession(user, preparation.requestContext);
    await writeAudit(preparation.requestContext, {
      actorUserId: user.id,
      action: "auth.login",
      targetType: "user",
      targetId: user.id,
    });

    return {
      user: toPublicUser(user),
      sessionExpiresAt: session.expiresAt,
      cookies: createSessionCookies(session.rawSessionToken, session.csrfToken),
    };
  }

  async function loginWithFirebaseToken(
    input: { idToken: string },
    context: AuthServiceContext,
  ): Promise<{ user: PublicAuthUser; sessionExpiresAt: number; cookies: AuthCookie[] }> {
    if (!firebase || !input.idToken || input.idToken.length > 8192) {
      throw new AuthError(
        503,
        "AUTH_INFRASTRUCTURE_UNAVAILABLE",
        "Authentication is temporarily unavailable.",
      );
    }

    const requestContext = validationContext(context);
    await enforceAuthRateLimit(
      dependencies.env.RATE_LIMIT_AUTH,
      `google:ip:${requestContext.security.ipAddress}`,
    );

    let account: FirebaseAccountInfo;
    try {
      account = await firebase.getAccountInfo(input.idToken);
    } catch (error) {
      throw googleAuthenticationError(error);
    }
    assertGoogleAccount(account);

    const emailLookupKey = requireSecret(dependencies.env, "EMAIL_LOOKUP_KEY_V1");
    const encryptionKey = requireSecret(dependencies.env, "DATA_ENCRYPTION_KEY_V1");
    const email = normalizeEmail(account.email);
    const emailLookupHash = createEmailLookupHash(email, emailLookupKey);
    const user = await resolveGoogleUser(
      dependencies.store,
      account,
      email,
      emailLookupHash,
      encryptionKey,
      now(),
    );

    await revokePreviousLoginSession(requestContext, user.id);
    const session = await createLoginSession(user, requestContext);
    await writeAudit(requestContext, {
      actorUserId: user.id,
      action: "auth.login_google",
      targetType: "user",
      targetId: user.id,
    });

    return {
      user: toPublicUser(user),
      sessionExpiresAt: session.expiresAt,
      cookies: createSessionCookies(session.rawSessionToken, session.csrfToken),
    };
  }

  async function getSession(request: Request, at = now()): Promise<AuthenticatedSession | null> {
    const rawToken = getSessionToken(request);
    if (!rawToken) {
      return null;
    }
    const current = await dependencies.store.findActiveSessionByTokenHash(
      hashOpaqueToken(rawToken),
      at,
    );
    if (!current || current.status !== "ACTIVE" || !current.emailVerifiedAt) {
      return null;
    }
    await dependencies.store.touchSession(current.id, at);
    return { session: current, user: { id: current.userId, username: current.username } };
  }

  async function logout(context: AuthServiceContext): Promise<{ cookies: AuthCookie[] }> {
    const current = await currentSession(context, false);
    if (current) {
      await dependencies.store.revokeSession(current.session.id, current.user.id, now());
      await writeAudit(context, {
        actorUserId: current.user.id,
        action: "auth.logout",
        targetType: "session",
        targetId: current.session.id,
      });
    }
    return { cookies: clearSessionCookies() };
  }

  async function logoutAll(
    context: AuthServiceContext,
  ): Promise<{ user: PublicAuthUser; cookies: AuthCookie[] }> {
    const current = await currentSession(context);
    await dependencies.store.revokeAllSessions(current!.user.id, now());
    await writeAudit(context, {
      actorUserId: current!.user.id,
      action: "auth.logout_all",
      targetType: "user",
      targetId: current!.user.id,
    });
    return { user: current!.user, cookies: clearSessionCookies() };
  }

  // fallow-ignore-next-line complexity -- Firebase action codes fall back to legacy tokens for existing accounts.
  async function verifyEmail(
    token: string,
    context: AuthServiceContext,
  ): Promise<{ verified: true }> {
    if (firebase) {
      try {
        const remote = await firebase.confirmEmailVerification(token);
        const emailLookupKey = requireSecret(dependencies.env, "EMAIL_LOOKUP_KEY_V1");
        const user = await dependencies.store.findUserByEmailLookupHash(
          createEmailLookupHash(normalizeEmail(remote.email), emailLookupKey),
        );
        if (!user || (remote.localId && remote.localId !== user.id)) {
          throw new AuthError(
            400,
            "VERIFICATION_TOKEN_INVALID",
            "The verification link is invalid or expired.",
          );
        }
        await dependencies.store.markEmailVerified(user.id, now());
        await writeAudit(context, {
          actorUserId: user.id,
          action: "auth.email_verified",
          targetType: "user",
          targetId: user.id,
        });
        return { verified: true };
      } catch (error) {
        const canTryLegacyToken =
          isFirebaseAuthError(error) &&
          ["INVALID_OOB_CODE", "EXPIRED_OOB_CODE", "INVALID_ACTION_CODE"].includes(error.code);
        if (!canTryLegacyToken) {
          if (error instanceof AuthError) throw error;
          throw actionCodeError(error, "VERIFICATION_TOKEN_INVALID");
        }
      }
    }

    if (!token || token.length < 32 || token.length > 256) {
      throw new AuthError(
        400,
        "VERIFICATION_TOKEN_INVALID",
        "The verification link is invalid or expired.",
      );
    }
    const userId = await dependencies.store.consumeEmailVerificationToken(
      hashOpaqueToken(token),
      now(),
    );
    if (!userId) {
      throw new AuthError(
        400,
        "VERIFICATION_TOKEN_INVALID",
        "The verification link is invalid or expired.",
      );
    }
    await dependencies.store.markEmailVerified(userId, now());
    await writeAudit(context, {
      actorUserId: userId,
      action: "auth.email_verified",
      targetType: "user",
      targetId: userId,
    });
    return { verified: true };
  }

  // fallow-ignore-next-line complexity -- Firebase and legacy reset delivery share enumeration-safe behavior.
  async function forgotPassword(
    input: { email: string; turnstileToken?: string },
    context: AuthServiceContext,
  ): Promise<{ accepted: true }> {
    const requestContext = validationContext(context);
    if (!/^\S+@\S+\.\S+$/.test(input.email) || input.email.length > 320) {
      throw new AuthError(400, "INVALID_EMAIL", "Enter a valid email address.");
    }
    await enforceAuthRateLimit(
      dependencies.env.RATE_LIMIT_AUTH,
      `password-reset:ip:${requestContext.security.ipAddress}`,
    );
    await verifyTurnstile(input.turnstileToken);
    if (!firebase) requireEmailDelivery(dependencies.env);
    const emailLookupKey = requireSecret(dependencies.env, "EMAIL_LOOKUP_KEY_V1");
    const encryptionKey = requireSecret(dependencies.env, "DATA_ENCRYPTION_KEY_V1");
    const normalizedEmail = normalizeEmail(input.email);
    const emailLookupHash = createEmailLookupHash(normalizedEmail, emailLookupKey);
    await enforceAuthRateLimit(
      dependencies.env.RATE_LIMIT_AUTH,
      `password-reset:account:${emailLookupHash}`,
    );
    const user = await dependencies.store.findUserByEmailLookupHash(emailLookupHash);

    if (firebase) {
      try {
        await firebase.sendPasswordReset(
          normalizedEmail,
          new URL("/forgot-password", requestContext.request.url).toString(),
        );
      } catch (error) {
        if (
          isFirebaseAuthError(error) &&
          ["EMAIL_NOT_FOUND", "USER_NOT_FOUND"].includes(error.code)
        ) {
          return { accepted: true };
        }
        if (isFirebaseAuthError(error) && error.code === "TOO_MANY_ATTEMPTS_TRY_LATER") {
          throw new AuthError(429, "AUTH_RATE_LIMITED", "Too many attempts. Try again later.");
        }
        throw new AuthError(
          503,
          "AUTH_INFRASTRUCTURE_UNAVAILABLE",
          "Authentication is temporarily unavailable.",
        );
      }
      if (user && user.status !== "DELETED") {
        await writeAudit(requestContext, {
          actorUserId: user.id,
          action: "auth.password_reset_requested",
          targetType: "user",
          targetId: user.id,
        });
      }
      return { accepted: true };
    }

    if (!user || user.status === "DELETED") {
      return { accepted: true };
    }

    const token = createOpaqueToken();
    const createdAt = now();
    await dependencies.store.createPasswordResetToken({
      id: createIdentifier(),
      userId: user.id,
      tokenHash: hashOpaqueToken(token),
      createdAt,
      expiresAt: createdAt + PASSWORD_RESET_TTL_MS,
    });
    const resetUrl = new URL(
      `/forgot-password?token=${encodeURIComponent(token)}`,
      requestContext.request.url,
    ).toString();
    await sendEmail({
      to: decryptEmail(user.emailEncrypted, encryptionKey),
      subject: "Reset your SourceBoard password",
      text: `Reset your SourceBoard password by opening this link:\n\n${resetUrl}\n\nThis link expires in one hour and can be used once.`,
    });
    await writeAudit(requestContext, {
      actorUserId: user.id,
      action: "auth.password_reset_requested",
      targetType: "user",
      targetId: user.id,
    });
    return { accepted: true };
  }

  // fallow-ignore-next-line complexity -- Firebase action-code validation and legacy token handling remain compatible.
  async function resetPassword(
    input: { token: string; password: string; turnstileToken?: string },
    context: AuthServiceContext,
  ): Promise<{ reset: true; cookies: AuthCookie[] }> {
    if (!input.token || input.token.length < 32 || input.token.length > 256) {
      throw new AuthError(400, "RESET_TOKEN_INVALID", "The reset link is invalid or expired.");
    }
    validatePassword(input.password);
    await enforceAuthRateLimit(
      dependencies.env.RATE_LIMIT_AUTH,
      `password-reset:token:${hashOpaqueToken(input.token)}`,
    );
    await verifyTurnstile(input.turnstileToken);
    if (firebase) {
      let actionCode: { email: string; localId?: string };
      try {
        actionCode = await firebase.getPasswordResetInfo(input.token);
      } catch (error) {
        throw actionCodeError(error, "RESET_TOKEN_INVALID");
      }

      const emailLookupKey = requireSecret(dependencies.env, "EMAIL_LOOKUP_KEY_V1");
      const user = await dependencies.store.findUserByEmailLookupHash(
        createEmailLookupHash(normalizeEmail(actionCode.email), emailLookupKey),
      );
      if (!user || (actionCode.localId && actionCode.localId !== user.id)) {
        throw new AuthError(400, "RESET_TOKEN_INVALID", "The reset link is invalid or expired.");
      }

      try {
        await firebase.confirmPasswordReset(input.token, input.password);
      } catch (error) {
        throw actionCodeError(error, "RESET_TOKEN_INVALID");
      }
      await dependencies.store.revokeAllSessions(user.id, now());
      await writeAudit(context, {
        actorUserId: user.id,
        action: "auth.password_reset_completed",
        targetType: "user",
        targetId: user.id,
      });
      return { reset: true, cookies: clearSessionCookies() };
    }

    const userId = await dependencies.store.consumePasswordResetToken(
      hashOpaqueToken(input.token),
      now(),
    );
    if (!userId) {
      throw new AuthError(400, "RESET_TOKEN_INVALID", "The reset link is invalid or expired.");
    }
    await dependencies.store.replacePasswordAndRevokeSessions(
      userId,
      await hashPassword(input.password),
      now(),
    );
    await writeAudit(context, {
      actorUserId: userId,
      action: "auth.password_reset_completed",
      targetType: "user",
      targetId: userId,
    });
    return { reset: true, cookies: clearSessionCookies() };
  }

  async function changePassword(
    input: { currentPassword: string; newPassword: string },
    context: AuthServiceContext,
  ): Promise<{ changed: true; cookies: AuthCookie[] }> {
    validatePassword(input.newPassword);
    const current = await currentSession(context);
    const credentials = await dependencies.store.getCredentials(current!.user.id);
    if (!credentials && firebase) {
      const encryptionKey = requireSecret(dependencies.env, "DATA_ENCRYPTION_KEY_V1");
      const currentUser = await dependencies.store.getUserById(current!.user.id);
      if (!currentUser) {
        throw new AuthError(401, "AUTHENTICATION_FAILED", "The current password is incorrect.");
      }
      try {
        const remote = await firebase.signInWithPassword({
          email: decryptEmail(currentUser.emailEncrypted, encryptionKey),
          password: input.currentPassword,
        });
        if (remote.localId !== currentUser.id) {
          throw new AuthError(401, "AUTHENTICATION_FAILED", "The current password is incorrect.");
        }
        await firebase.updatePassword(remote.idToken, input.newPassword);
      } catch (error) {
        if (error instanceof AuthError) throw error;
        throw authenticationError(error);
      }
      await dependencies.store.revokeAllSessions(currentUser.id, now());
      await writeAudit(context, {
        actorUserId: currentUser.id,
        action: "auth.password_changed",
        targetType: "user",
        targetId: currentUser.id,
      });
      return { changed: true, cookies: clearSessionCookies() };
    }

    if (!credentials || !(await verifyPassword(input.currentPassword, credentials))) {
      throw new AuthError(401, "AUTHENTICATION_FAILED", "The current password is incorrect.");
    }
    await dependencies.store.replacePasswordAndRevokeSessions(
      current!.user.id,
      await hashPassword(input.newPassword),
      now(),
    );
    await writeAudit(context, {
      actorUserId: current!.user.id,
      action: "auth.password_changed",
      targetType: "user",
      targetId: current!.user.id,
    });
    return { changed: true, cookies: clearSessionCookies() };
  }

  async function listSessions(context: AuthServiceContext): Promise<SessionSummary[]> {
    const current = await currentSession(context);
    const sessions = await dependencies.store.listSessions(current!.user.id, now());
    return sessions.map((session: SessionRecord) => ({
      id: session.id,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      current: session.id === current!.session.id,
      userAgentHash: session.userAgentHash,
    }));
  }

  async function revokeSession(sessionId: string, context: AuthServiceContext): Promise<void> {
    const current = await currentSession(context);
    await dependencies.store.revokeSession(sessionId, current!.user.id, now());
    await writeAudit(context, {
      actorUserId: current!.user.id,
      action: "auth.session_revoked",
      targetType: "session",
      targetId: sessionId,
    });
  }

  async function changeRole(
    input: { targetUserId: string; role: RoleSlug; operation: "assign" | "remove"; reason: string },
    context: AuthServiceContext,
  ): Promise<void> {
    if (!input.reason.trim() || input.reason.length > 500) {
      throw new AuthError(
        400,
        "AUDIT_REASON_REQUIRED",
        "Provide a reason for this security change.",
      );
    }
    const current = await currentSession(context);
    const targetUser = await dependencies.store.getUserById(input.targetUserId);
    if (!targetUser) {
      throw new AuthError(404, "USER_NOT_FOUND", "The target user was not found.");
    }
    const actorAuthorization = await dependencies.store.getAuthorization(current!.user.id);
    const targetAuthorization = await dependencies.store.getAuthorization(input.targetUserId);
    assertCanChangeRole(actorAuthorization, targetAuthorization, input.role, input.operation);
    await dependencies.store.changeRole(
      input.targetUserId,
      input.role,
      input.operation,
      current!.user.id,
      now(),
    );
    await writeAudit(context, {
      actorUserId: current!.user.id,
      action: `rbac.role_${input.operation}`,
      targetType: "user",
      targetId: input.targetUserId,
      reason: input.reason.trim(),
      metadata: { role: input.role, operation: input.operation },
    });
  }

  async function getAuthorization(context: AuthServiceContext): Promise<AuthorizationSnapshot> {
    const current = await currentSession(context);
    return dependencies.store.getAuthorization(current!.user.id);
  }

  return {
    register,
    login,
    loginWithFirebaseToken,
    getSession,
    logout,
    logoutAll,
    verifyEmail,
    forgotPassword,
    resetPassword,
    changePassword,
    listSessions,
    revokeSession,
    changeRole,
    getAuthorization,
  };
}

export function createAuthContext(request: Request, requestId: string): AuthServiceContext {
  return {
    request,
    requestId,
    security: getRequestSecurityContext(request),
  };
}

export function authCookiesToHeaders(cookies: AuthCookie[]): string[] {
  return cookies.map((cookie) =>
    cookie.maxAge === 0
      ? serializeCookie(cookie.name, "", { maxAge: 0, httpOnly: cookie.httpOnly })
      : serializeCookie(cookie.name, cookie.value, {
          maxAge: cookie.maxAge,
          httpOnly: cookie.httpOnly,
        }),
  );
}
