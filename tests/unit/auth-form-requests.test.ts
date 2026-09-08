import { describe, expect, it } from "vitest";

import { postAuthJson } from "../../app/data/auth-client";

describe("browser authentication requests", () => {
  it("sends the readable CSRF cookie with JSON auth mutations", async () => {
    const previousDocument = (globalThis as { document?: unknown }).document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { cookie: "__Host-sourceboard_csrf=csrf-token" },
    });

    let request: RequestInit | undefined;
    try {
      const response = await postAuthJson(
        "/api/auth/login",
        { email: "user@example.com", password: "password" },
        async (_url, init) => {
          request = init;
          return new Response("{}", { status: 200 });
        },
      );

      const headers = new Headers(request?.headers);
      expect(response.ok).toBe(true);
      expect(headers.get("content-type")).toBe("application/json");
      expect(headers.get("x-csrf-token")).toBe("csrf-token");
      expect(request?.body).toBe(
        JSON.stringify({ email: "user@example.com", password: "password" }),
      );
    } finally {
      if (previousDocument === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        Object.defineProperty(globalThis, "document", {
          configurable: true,
          value: previousDocument,
        });
      }
    }
  });
});
