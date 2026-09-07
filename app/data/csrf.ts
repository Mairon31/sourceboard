const CSRF_COOKIE = "__Host-sourceboard_csrf=";

export function readCsrfToken(): string {
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(CSRF_COOKIE));
  return entry ? decodeURIComponent(entry.slice(CSRF_COOKIE.length)) : "";
}
