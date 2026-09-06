import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
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
    description: "Use the single-use link sent to your email to activate your account.",
  },
} satisfies Record<AuthMode, { eyebrow: string; title: string; description: string }>;

interface TurnstileConfig {
  turnstileSiteKey: string | null;
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

function useTurnstileConfig(): TurnstileConfig | null {
  const [config, setConfig] = useState<TurnstileConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    const setIfActive = (value: TurnstileConfig | null) => {
      if (!cancelled) {
        setConfig(value);
      }
    };
    void fetch("/api/auth/config")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as TurnstileConfig;
      })
      .then(setIfActive)
      .catch(() => setIfActive({ turnstileSiteKey: null }));

    return () => {
      cancelled = true;
    };
  }, []);
  return config;
}

function useTurnstileScript(siteKey: string | null): boolean {
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!siteKey) {
      return;
    }

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
    document.head.appendChild(script);
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
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!canRenderTurnstile(siteKey, scriptReady, container)) {
      return;
    }

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
  }, [siteKey, onToken, scriptReady, containerRef]);
}

function getTurnstileSiteKey(config: TurnstileConfig | null): string | null {
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
    <div ref={containerRef} aria-label="Security check" />
  ) : (
    <p className="product-auth-security-note">
      This form requires Cloudflare Turnstile after the site security configuration is available.
    </p>
  );
}

function TurnstileField({ onToken }: { onToken: (token: string | undefined) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const siteKey = getTurnstileSiteKey(useTurnstileConfig());
  const scriptReady = useTurnstileScript(siteKey);
  useTurnstileWidget(siteKey, scriptReady, containerRef, onToken);
  return <TurnstileContent enabled={Boolean(siteKey)} containerRef={containerRef} />;
}

function getErrorMessage(value: unknown): string {
  const message = (value as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === "string" ? message : "The request could not be completed. Try again.";
}

const endpointByMode: Record<AuthMode, string> = {
  login: "/api/auth/login",
  register: "/api/auth/register",
  forgot: "/api/auth/password/forgot",
  verify: "/api/auth/email/verify",
};

function getAuthEndpoint(mode: AuthMode, isReset: boolean): string {
  return isReset ? "/api/auth/password/reset" : endpointByMode[mode];
}

function buildAuthValues(
  form: HTMLFormElement,
  mode: AuthMode,
  resetToken: string | null,
  turnstileToken: string | undefined,
): Record<string, FormDataEntryValue> {
  const values = Object.fromEntries(new FormData(form).entries());
  if (turnstileToken) {
    values.turnstileToken = turnstileToken;
  }
  if (mode === "verify" && resetToken) {
    values.token = resetToken;
  }
  return values;
}

async function submitAuthForm(
  form: HTMLFormElement,
  mode: AuthMode,
  isReset: boolean,
  resetToken: string | null,
  turnstileToken: string | undefined,
): Promise<{ ok: boolean; body: unknown }> {
  const response = await fetch(getAuthEndpoint(mode, isReset), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildAuthValues(form, mode, resetToken, turnstileToken)),
  });
  return { ok: response.ok, body: await response.json() };
}

function handleSuccessfulSubmit(
  mode: AuthMode,
  isReset: boolean,
  navigate: (to: string) => void,
  setFeedback: (feedback: AuthFeedback) => void,
): void {
  const redirectByMode: Partial<Record<AuthMode, string>> = {
    login: "/",
    verify: "/login",
  };
  const redirect = redirectByMode[mode];
  if (redirect) {
    navigate(redirect);
    return;
  }
  setFeedback({
    tone: "status",
    message: isReset
      ? "Your password was changed. You can sign in with the new password."
      : "If the account exists, a single-use link will arrive shortly.",
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
  resetToken,
  onToken,
}: {
  mode: AuthMode;
  resetToken: string | null;
  onToken: (token: string | undefined) => void;
}) {
  const turnstileRequired = new Set<AuthMode>(["register", "forgot"]).has(mode);
  return (
    <>
      {turnstileRequired ? <TurnstileField onToken={onToken} /> : null}
      {mode === "verify" && !resetToken ? (
        <p className="product-auth-security-note">
          Open the verification link from your email to continue.
        </p>
      ) : null}
    </>
  );
}

function getSubmitLabel(mode: AuthMode, isReset: boolean): string {
  const labels: Record<AuthMode, string> = {
    login: "Sign in",
    register: "Create account",
    forgot: "Send reset link",
    verify: "Verify email",
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

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const content = copy[mode];
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token");
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);

  const isReset = mode === "forgot" && Boolean(resetToken);
  const turnstileRequired = mode === "register" || mode === "forgot";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const result = await submitAuthForm(
        event.currentTarget,
        mode,
        isReset,
        resetToken,
        turnstileToken,
      );
      if (!result.ok) {
        setFeedback({ tone: "error", message: getErrorMessage(result.body) });
        return;
      }

      handleSuccessfulSubmit(mode, isReset, navigate, setFeedback);
    } catch {
      setFeedback({ tone: "error", message: "The request could not be completed. Try again." });
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

        <form className="product-form-grid" onSubmit={handleSubmit}>
          <AuthIdentityFields mode={mode} isReset={isReset} />
          <AuthPasswordField mode={mode} isReset={isReset} />
          <AuthSecurityFields mode={mode} resetToken={resetToken} onToken={setTurnstileToken} />
          <Button type="submit" loading={busy} disabled={turnstileRequired && !turnstileToken}>
            {getSubmitLabel(mode, isReset)}
          </Button>
        </form>

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
