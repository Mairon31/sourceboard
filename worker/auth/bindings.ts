import type { SourceBoardEnvironment } from "../environment";
import { AuthError } from "./errors";

const RETRY_AFTER_SECONDS = 60;

export async function enforceAuthRateLimit(
  binding: RateLimit | undefined,
  key: string,
): Promise<void> {
  if (!binding) {
    throw new AuthError(
      503,
      "AUTH_INFRASTRUCTURE_UNAVAILABLE",
      "Authentication is temporarily unavailable.",
    );
  }

  const outcome = await binding.limit({ key });
  if (!outcome.success) {
    throw new AuthError(429, "AUTH_RATE_LIMITED", "Too many attempts. Try again later.", {
      retryAfter: RETRY_AFTER_SECONDS,
    });
  }
}

export async function requireTurnstile(
  env: SourceBoardEnvironment,
  token: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET) {
    throw new AuthError(
      503,
      "AUTH_INFRASTRUCTURE_UNAVAILABLE",
      "Authentication is temporarily unavailable.",
    );
  }

  if (!token) {
    throw new AuthError(400, "TURNSTILE_REQUIRED", "Complete the security check and try again.");
  }

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET,
    response: token,
  });
  const response = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new AuthError(
      503,
      "TURNSTILE_UNAVAILABLE",
      "The security check is temporarily unavailable.",
    );
  }

  const result = (await response.json()) as { success?: boolean };
  if (!result.success) {
    throw new AuthError(400, "TURNSTILE_FAILED", "Complete the security check and try again.");
  }
}

export async function sendTransactionalEmail(
  env: SourceBoardEnvironment,
  message: { to: string; subject: string; text: string; html?: string },
): Promise<void> {
  if (!env.EMAIL || !env.EMAIL_FROM) {
    throw new AuthError(
      503,
      "AUTH_INFRASTRUCTURE_UNAVAILABLE",
      "Authentication is temporarily unavailable.",
    );
  }

  await env.EMAIL.send({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
