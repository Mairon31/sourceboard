import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  getGoogleAuthErrorMessage,
  signInWithGoogle,
  signOutFirebase,
  type FirebasePublicConfig,
} from "../../data/firebase-client";
import { postAuthJson } from "../../data/auth-client";
import { Button, GlassPanel, Input } from "../ui";

export type AuthMode = "login" | "register" | "forgot" | "verify";
type AuthFeedback = { tone: "status" | "error"; message: string };

const copy = {
  login: {
    eyebrow: "SourceBoard account",
    title: "Welcome back",
    description: "Sign in to comment, save source requests and manage your profile.",
  },
  register: {
    eyebrow: "Join SourceBoard",
    title: "Create your account",
    description: "Create a public identity for source contributions and community participation.",
  },
  forgot: {
    eyebrow: "Account recovery",
    title: "Reset your password",
    description: "Request a single-use password reset link or choose a new password from one.",
  },
  verify: {
    eyebrow: "Email verification",
    title: "Verify your email",
    description:
      "SourceBoard and Firebase share one verification flow. Open the email link and return here to finish account setup.",
  },
} satisfies Record<AuthMode, { eyebrow: string; title: string; description: string }>;

interface AuthConfig {
  turnstileSiteKey: string | null;
  firebase?: FirebasePublicConfig | null;
}

declare global {
  interface Window {
    turnstile?: {
      render(
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ): string;
      remove(widgetId: string): void;
    };
  }
}

function useAuthConfig(): AuthConfig | null {
  const [config, setConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    const setIfActive = (value: AuthConfig | null) => {
      if (!cancelled) setConfig(value);
    };
    void fetch("/api/auth/config")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as AuthConfig;
      })
      .then(setIfActive)
      .catch(() => setIfActive({ turnstileSiteKey: null, firebase: null }));

    return () => {
      cancelled = true;
    };
  }, []);
  return config;
}

function useTurnstileScript(siteKey: string | null): boolean {
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!siteKey) return;
    const scriptId = "sourceboard-turnstile-script";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (window.turnstile) {
      setScriptReady(true);
      return;
    }
    const script = existing ?? document.createElement("script");
    script.id = scriptId;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => setScriptReady(true), { once: true });
    if (!existing) document.head.appendChild(script);
  }, [siteKey]);
  return scriptReady;
}

function canRenderTurnstile(
  siteKey: string | null,
  scriptReady: boolean,
  container: HTMLDivElement | null,
): boolean {
  return Boolean(siteKey) && scriptReady && Boolean(container) && Boolean(window.turnstile);
}

function useTurnstileWidget(
  siteKey: string | null,
  scriptReady: boolean,
  containerRef: RefObject<HTMLDivElement | null>,
  onToken: (token: string | undefined) => void,
  resetKey: number,
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!canRenderTurnstile(siteKey, scriptReady, container)) return;
    const widgetId = window.turnstile!.render(container!, {
      sitekey: siteKey!,
      callback: onToken,
      "expired-callback": () => onToken(undefined),
      "error-callback": () => onToken(undefined),
    });
    return () => {
      window.turnstile?.remove(widgetId);
      onToken(undefined);
    };
  }, [siteKey, onToken, scriptReady, containerRef, resetKey]);
}

function getTurnstileSiteKey(config: AuthConfig | null): string | null {
  return config ? config.turnstileSiteKey : null;
}

function TurnstileContent({
  enabled,
  containerRef,
}: {
  enabled: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  return enabled ? (
    <div ref={containerRef} aria-label="Cloudflare security check" />
  ) : (
    <p className="product-auth-security-note" role="status">
      Cloudflare Turnstile is required before this form can be submitted.
    </p>
  );
}

function TurnstileField({
  config,
  onToken,
  resetKey,
}: {
  config: AuthConfig | null;
  onToken: (token: string | undefined) => void;
  resetKey: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const siteKey = getTurnstileSiteKey(config);
  const scriptReady = useTurnstileScript(siteKey);
  useTurnstileWidget(siteKey, scriptReady, containerRef, onToken, resetKey);
  return (
    <div className="product-auth-security">
      <TurnstileContent enabled={Boolean(siteKey)} containerRef={containerRef} />
      {siteKey ? (
        <p className="product-auth-security-note">Protected by Cloudflare Turnstile.</p>
      ) : null}
    </div>
  );
}

function getErrorMessage(value: unknown): string {
  const error = (value as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  if (error?.code === "ACCOUNT_UNAVAILABLE") {
    return "We couldn't create that account. If you already registered this email, sign in or reset your password.";
  }
  if (error?.code === "CSRF_TOKEN_INVALID") {
    return "Your previous session security state expired. Retry this request; you do not need to refresh the page.";
  }
  if (error?.code === "TURNSTILE_REQUIRED" || error?.code === "TURNSTILE_FAILED") {
    return "The Cloudflare security check expired or was rejected. Complete the refreshed check and try again.";
  }
  const message = error?.message;
  return typeof message === "string" ? message : "The request could not be completed. Try again.";
}

const endpointByMode: Record<Exclude<AuthMode, "verify">, string> = {
  login: "/api/auth/login",
  register: "/api/auth/register",
  forgot: "/api/auth/password/forgot",
};

function getAuthEndpoint(mode: Exclude<AuthMode, "verify">, isReset: boolean): string {
  return isReset ? "/api/auth/password/reset" : endpointByMode[mode];
}

function buildAuthValues(
  form: HTMLFormElement,
  isReset: boolean,
  resetToken: string | null,
  turnstileToken: string | undefined,
): Record<string, FormDataEntryValue> {
  const values = Object.fromEntries(new FormData(form).entries());
  if (turnstileToken) values.turnstileToken = turnstileToken;
  if (isReset && resetToken) values.token = resetToken;
  return values;
}

async function submitAuthForm(
  form: HTMLFormElement,
  mode: Exclude<AuthMode, "verify">,
  isReset: boolean,
  resetToken: string | null,
  turnstileToken: string | undefined,
): Promise<{ ok: boolean; body: unknown }> {
  const response = await postAuthJson(
    getAuthEndpoint(mode, isReset),
    buildAuthValues(form, isReset, resetToken, turnstileToken),
  );
  return { ok: response.ok, body: await response.json() };
}

async function submitVerificationToken(token: string): Promise<{ ok: boolean; body: unknown }> {
  const response = await postAuthJson("/api/auth/email/verify", { token });
  return { ok: response.ok, body: await response.json() };
}

async function completeGoogleSession(
  idToken: string,
  turnstileToken: string,
  navigate: (to: string) => void,
  setFeedback: (feedback: AuthFeedback) => void,
): Promise<boolean> {
  const response = await postAuthJson("/api/auth/google", { idToken, turnstileToken });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    await signOutFirebase().catch(() => undefined);
    setFeedback({ tone: "error", message: getErrorMessage(body) });
    return false;
  }
  navigate("/");
  return true;
}

function useVerificationAction(
  mode: AuthMode,
  token: string | null,
  navigate: (to: string) => void,
  setBusy: (busy: boolean) => void,
  setFeedback: (feedback: AuthFeedback | null) => void,
): void {
  const attempted = useRef(false);
  useEffect(() => {
    if (mode !== "verify" || !token || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    setFeedback({ tone: "status", message: "Confirming your email with Firebase…" });
    void submitVerificationToken(token)
      .then((result) => {
        if (result.ok) {
          navigate("/login?verified=1");
          return;
        }
        setFeedback({ tone: "error", message: getErrorMessage(result.body) });
      })
      .catch(() => {
        setFeedback({ tone: "error", message: "The verification link could not be completed." });
      })
      .finally(() => setBusy(false));
  }, [mode, navigate, setBusy, setFeedback, token]);
}

function handleSuccessfulSubmit(
  mode: Exclude<AuthMode, "verify">,
  isReset: boolean,
  body: unknown,
  navigate: (to: string) => void,
  setFeedback: (feedback: AuthFeedback) => void,
): void {
  if (mode === "login") {
    navigate("/");
    return;
  }
  if (mode === "register") {
    const verificationRequired =
      (body as { verificationRequired?: unknown } | null)?.verificationRequired !== false;
    navigate(verificationRequired ? "/verify-email?sent=1" : "/");
    return;
  }
  setFeedback({
    tone: "status",
    message: isReset
      ? "Your password was changed. You can sign in with the new password."
      : "If the account exists, a password reset link will arrive shortly.",
  });
}

function AuthIdentityFields({ mode, isReset }: { mode: AuthMode; isReset: boolean }) {
  return (
    <>
      {mode === "register" ? <Input label="Username" name="username" required /> : null}
      {mode !== "verify" && !isReset ? (
        <Input label="Email" name="email" type="email" autoComplete="email" required />
      ) : null}
    </>
  );
}

function AuthPasswordField({ mode, isReset }: { mode: AuthMode; isReset: boolean }) {
  const modeConfig: Partial<Record<AuthMode, { label: string; autoComplete: string }>> = {
    login: { label: "Password", autoComplete: "current-password" },
    register: { label: "Password", autoComplete: "new-password" },
  };
  const config = isReset
    ? { label: "New password", autoComplete: "new-password" }
    : modeConfig[mode];
  return config ? (
    <Input
      label={config.label}
      name="password"
      type="password"
      autoComplete={config.autoComplete}
      minLength={12}
      required
    />
  ) : null;
}

function AuthSecurityFields({
  mode,
  config,
  onToken,
  resetKey,
}: {
  mode: AuthMode;
  config: AuthConfig | null;
  onToken: (token: string | undefined) => void;
  resetKey: number;
}) {
  const turnstileRequired = mode === "login" || mode === "register" || mode === "forgot";
  return turnstileRequired ? (
    <TurnstileField config={config} onToken={onToken} resetKey={resetKey} />
  ) : null;
}

function getSubmitLabel(mode: Exclude<AuthMode, "verify">, isReset: boolean): string {
  const labels: Record<Exclude<AuthMode, "verify">, string> = {
    login: "Sign in",
    register: "Create account",
    forgot: "Send reset link",
  };
  return isReset ? "Set new password" : labels[mode];
}

function AuthLinks({ mode }: { mode: AuthMode }) {
  return (
    <div className="product-auth-links">
      {mode === "login" ? (
        <>
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/register">Create account</Link>
        </>
      ) : (
        <Link to="/login">Back to sign in</Link>
      )}
      <Link to="/">Browse SourceBoard</Link>
    </div>
  );
}

function VerificationHandoff({
  token,
  sent,
  busy,
  onContinue,
}: {
  token: string | null;
  sent: boolean;
  busy: boolean;
  onContinue: () => void;
}) {
  if (token) {
    return (
      <div className="product-form-grid" aria-live="polite">
        <p className="product-auth-security-note">
          {busy
            ? "Confirming the verification link with Firebase…"
            : "Verification link detected. SourceBoard is finishing the account sync."}
        </p>
      </div>
    );
  }

  return (
    <div className="product-form-grid">
      <p className="product-auth-security-note">
        {sent
          ? "We sent the verification email. Open it in this browser. If Firebase shows that your email is already verified, return here and sign in to finish the SourceBoard sync."
          : "If Firebase already confirmed your email, you do not need another verification token here. Sign in and SourceBoard will synchronize the verified account automatically."}
      </p>
      <Button type="button" onClick={onContinue}>
        Continue to sign in
      </Button>
    </div>
  );
}

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const content = copy[mode];
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authConfig = useAuthConfig();
  const verificationToken =
    mode === "verify" ? (searchParams.get("oobCode") ?? searchParams.get("token")) : null;
  const resetToken =
    mode === "forgot" ? (searchParams.get("oobCode") ?? searchParams.get("token")) : null;
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const isReset = mode === "forgot" && Boolean(resetToken);
  const turnstileRequired = mode === "login" || mode === "register" || mode === "forgot";
  const verificationSent = mode === "verify" && searchParams.get("sent") === "1";
  useVerificationAction(mode, verificationToken, navigate, setBusy, setFeedback);

  useEffect(() => {
    if (mode === "login" && searchParams.get("verified") === "1") {
      setFeedback({
        tone: "status",
        message: "Email verified. Sign in to finish synchronizing your SourceBoard account.",
      });
    }
  }, [mode, searchParams]);

  function refreshTurnstile() {
    setTurnstileToken(undefined);
    setTurnstileResetKey((value) => value + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "verify") return;
    const form = event.currentTarget;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await submitAuthForm(form, mode, isReset, resetToken, turnstileToken);
      if (!result.ok) {
        setFeedback({ tone: "error", message: getErrorMessage(result.body) });
        refreshTurnstile();
        return;
      }
      handleSuccessfulSubmit(mode, isReset, result.body, navigate, setFeedback);
    } catch {
      setFeedback({ tone: "error", message: "The request could not be completed. Try again." });
      refreshTurnstile();
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    if (busy || !turnstileToken) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (!authConfig?.firebase) throw new Error("FIREBASE_NOT_CONFIGURED");
      const { idToken } = await signInWithGoogle(authConfig.firebase);
      const completed = await completeGoogleSession(
        idToken,
        turnstileToken,
        navigate,
        (nextFeedback) => setFeedback(nextFeedback),
      );
      if (!completed) refreshTurnstile();
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error && error.message === "FIREBASE_NOT_CONFIGURED"
            ? "Google sign-in is not configured yet."
            : getGoogleAuthErrorMessage(error),
      });
      refreshTurnstile();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="product-auth-shell">
      <GlassPanel className="product-auth-card">
        <header>
          <span className="product-eyebrow">{content.eyebrow}</span>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </header>

        {mode === "verify" ? (
          <VerificationHandoff
            token={verificationToken}
            sent={verificationSent}
            busy={busy}
            onContinue={() => navigate("/login")}
          />
        ) : (
          <form className="product-form-grid" onSubmit={handleSubmit}>
            <AuthIdentityFields mode={mode} isReset={isReset} />
            <AuthPasswordField mode={mode} isReset={isReset} />
            <AuthSecurityFields
              mode={mode}
              config={authConfig}
              onToken={setTurnstileToken}
              resetKey={turnstileResetKey}
            />
            <Button type="submit" loading={busy} disabled={turnstileRequired && !turnstileToken}>
              {getSubmitLabel(mode, isReset)}
            </Button>
          </form>
        )}

        {mode === "login" || mode === "register" ? (
          <>
            <div className="product-auth-divider" role="separator">
              <span>or</span>
            </div>
            <button
              className="product-google-button"
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={busy || !turnstileToken}
              aria-busy={busy}
              title={!turnstileToken ? "Complete the Cloudflare security check first" : undefined}
            >
              <span className="product-google-button__icon" aria-hidden="true">
                G
              </span>
              Continue with Google
            </button>
          </>
        ) : null}

        {feedback ? (
          <p
            className={`product-auth-feedback product-auth-feedback--${feedback.tone}`}
            role="alert"
          >
            {feedback.message}
          </p>
        ) : null}

        <AuthLinks mode={mode} />
      </GlassPanel>
    </main>
  );
}
