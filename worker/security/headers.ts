function contentSecurityPolicy(cspNonce?: string): string {
  const scriptSource = cspNonce ? `'nonce-${cspNonce}'` : "'unsafe-inline'";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self' https://challenges.cloudflare.com wss:",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src https://challenges.cloudflare.com",
    "img-src 'self' data: blob:",
    "object-src 'none'",
    `script-src 'self' ${scriptSource} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
  ].join("; ");
}

/**
 * Applies the response boundary shared by API, SSR and media responses.
 *
 * SSR supplies a per-response nonce for inline scripts, including the theme
 * bootstrap and React Router's hydration scripts. Inline style attributes are
 * still required by the existing cosmetic surfaces and remain documented.
 */
export function withSecurityHeaders(
  response: Response,
  secureTransport = false,
  cspNonce?: string,
): Response {
  if (response.status === 101) return response;

  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", contentSecurityPolicy(cspNonce));
  headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (secureTransport) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
