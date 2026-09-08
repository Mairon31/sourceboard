import { readCsrfToken } from "./csrf";

export function buildAuthHeaders(csrfToken: string, init: HeadersInit = {}): Headers {
  const headers = new Headers(init);
  if (csrfToken) {
    headers.set("x-csrf-token", csrfToken);
  }
  return headers;
}

export function postAuthJson(
  url: string,
  body: unknown,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  return fetcher(url, {
    method: "POST",
    headers: buildAuthHeaders(readCsrfToken(), { "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
}
