import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loader } from "../../app/routes/official-alias";

const routes = readFileSync("app/routes.ts", "utf8");

describe("localized official aliases", () => {
  it("routes every unprefixed official surface through one redirect boundary", () => {
    expect(routes).toContain('index("routes/official-alias.tsx")');
    for (const path of ["store", "category", "docs", "legal"]) {
      expect(routes).toContain(`route("${path}", "routes/official-alias.tsx"`);
    }
    expect(routes).toContain('route("docs/:slug", "routes/official-alias.tsx"');
    expect(routes).toContain('route("legal/:slug", "routes/official-alias.tsx"');
  });

  it("redirects using SSR locale while preserving non-language query parameters", async () => {
    const request = new Request("https://srcboard.me/docs/guide?lang=es&ref=footer");
    await expect(loader({ request, context: {} } as never)).rejects.toMatchObject({
      status: 302,
      headers: expect.objectContaining({}),
    });
    try {
      await loader({ request, context: {} } as never);
    } catch (response) {
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).headers.get("location")).toBe("/es/docs/guide?ref=footer");
    }
  });

  it("never locale-prefixes UGC routes", () => {
    for (const path of ["posts/:postId", "sh/:shortId", "u/:username"]) {
      expect(routes).not.toContain(`route("${path}", "routes/official-alias.tsx"`);
    }
  });
});
