import { useState } from "react";
import { Link } from "react-router";
import { Button, GlassPanel, Input } from "../ui";
import { PresentationNotice } from "./ProductShell";

export type AuthMode = "login" | "register" | "forgot" | "verify";

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
    description: "Enter your email to preview the password-recovery flow.",
  },
  verify: {
    eyebrow: "Email verification",
    title: "Verify your email",
    description: "The production flow will verify a signed token delivered by transactional email.",
  },
} satisfies Record<AuthMode, { eyebrow: string; title: string; description: string }>;

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const [submitted, setSubmitted] = useState(false);
  const content = copy[mode];

  return (
    <main className="product-auth-shell">
      <GlassPanel className="product-auth-card">
        <header>
          <span className="product-eyebrow">{content.eyebrow}</span>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </header>

        {mode === "verify" ? (
          <div className="product-form-grid">
            <PresentationNotice>
              Email verification is intentionally presentation-only until the authentication phase.
            </PresentationNotice>
            <Button onClick={() => setSubmitted(true)}>Resend verification email</Button>
          </div>
        ) : (
          <form
            className="product-form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
            }}
          >
            {mode === "register" ? <Input label="Username" name="username" required /> : null}
            <Input label="Email" name="email" type="email" required />
            {mode === "login" || mode === "register" ? (
              <Input label="Password" name="password" type="password" required />
            ) : null}
            <Button type="submit">
              {mode === "login"
                ? "Sign in"
                : mode === "register"
                  ? "Create account"
                  : "Send reset link"}
            </Button>
          </form>
        )}

        {submitted ? (
          <PresentationNotice>No authentication or email write was performed.</PresentationNotice>
        ) : null}

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
      </GlassPanel>
    </main>
  );
}
