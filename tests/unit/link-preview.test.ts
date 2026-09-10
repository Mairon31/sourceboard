import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  createLinkPreviewService,
  createWorkersLinkPreviewCache,
  isPublicIpAddress,
  normalizeLinkPreviewUrl,
} from "../../worker/comments/link-preview";

function publicResolver() {
  return vi.fn(async () => ["93.184.216.34"]);
}

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("link preview URL policy", () => {
  it("normalizes public HTTP URLs and strips fragments", () => {
    expect(normalizeLinkPreviewUrl("https://example.com/a#fragment").toString()).toBe(
      "https://example.com/a",
    );
  });

  it("rejects unsafe schemes, credentials and local targets", () => {
    for (const value of [
      "file:///etc/passwd",
      "http://user:pass@example.com/",
      "http://localhost/test",
      "http://site.local/test",
      "http://127.0.0.1/test",
      "http://10.0.0.1/test",
      "http://[::1]/test",
      "http://[fc00::1]/test",
    ]) {
      expect(() => normalizeLinkPreviewUrl(value)).toThrow();
    }
  });

  it("recognizes representative public and private addresses", () => {
    expect(isPublicIpAddress("93.184.216.34")).toBe(true);
    expect(isPublicIpAddress("1.1.1.1")).toBe(true);
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("192.168.1.20")).toBe(false);
    expect(isPublicIpAddress("169.254.1.1")).toBe(false);
    expect(isPublicIpAddress("::1")).toBe(false);
    expect(isPublicIpAddress("fc00::1")).toBe(false);
    expect(isPublicIpAddress("fe80::1")).toBe(false);
    expect(isPublicIpAddress("2001:4860:4860::8888")).toBe(true);
  });
});

describe("link preview metadata fetcher", () => {
  it("rejects a hostname resolving to a private address", async () => {
    const service = createLinkPreviewService({
      fetchImpl: vi.fn() as unknown as typeof fetch,
      resolveHost: vi.fn(async () => ["192.168.1.2"]),
    });
    await expect(service.preview("https://private.example/")).rejects.toMatchObject({
      code: "LINK_PREVIEW_PRIVATE_TARGET",
    });
  });

  it("revalidates redirect targets and rejects a private redirect", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }),
    ) as unknown as typeof fetch;
    const service = createLinkPreviewService({ fetchImpl, resolveHost: publicResolver() });
    await expect(service.preview("https://example.com/start")).rejects.toMatchObject({
      code: "LINK_PREVIEW_PRIVATE_TARGET",
    });
  });

  it("rejects a sixth redirect", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const current = new URL(typeof input === "string" ? input : input.toString());
      const hop = Number(current.searchParams.get("hop") ?? "0");
      return new Response(null, {
        status: 302,
        headers: { location: `https://example.com/?hop=${hop + 1}` },
      });
    }) as unknown as typeof fetch;
    const service = createLinkPreviewService({ fetchImpl, resolveHost: publicResolver() });
    await expect(service.preview("https://example.com/?hop=0")).rejects.toMatchObject({
      code: "LINK_PREVIEW_TOO_MANY_REDIRECTS",
    });
  });

  it("returns URL-only metadata when the target fetch fails", async () => {
    const service = createLinkPreviewService({
      fetchImpl: vi.fn(async () => {
        throw new Error("network unavailable");
      }) as unknown as typeof fetch,
      resolveHost: publicResolver(),
      now: () => 1234,
    });
    await expect(service.preview("https://example.com/a#fragment")).resolves.toEqual({
      canonicalUrl: "https://example.com/a",
      siteName: null,
      title: null,
      description: null,
      imageUrl: null,
      fetchedAt: 1234,
      metadataStatus: "URL_ONLY",
    });
  });

  it("extracts bounded readable metadata and resolves a relative image", async () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="Example &amp; title">
      <meta property="og:description" content="Useful description">
      <meta property="og:site_name" content="Example Site">
      <meta property="og:image" content="/preview.webp">
    </head><body>ignored</body></html>`;
    const service = createLinkPreviewService({
      fetchImpl: vi.fn(
        async () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }),
      ) as unknown as typeof fetch,
      resolveHost: publicResolver(),
      now: () => 2000,
    });
    await expect(service.preview("https://example.com/post")).resolves.toMatchObject({
      canonicalUrl: "https://example.com/post",
      siteName: "Example Site",
      title: "Example & title",
      description: "Useful description",
      imageUrl: "https://example.com/preview.webp",
      fetchedAt: 2000,
      metadataStatus: "COMPLETE",
    });
  });

  it("uses cached snapshots without fetching the target again", async () => {
    const snapshot = {
      canonicalUrl: "https://example.com/cached",
      siteName: null,
      title: "Cached",
      description: null,
      imageUrl: null,
      fetchedAt: 10,
      metadataStatus: "PARTIAL" as const,
    };
    const cache = {
      get: vi.fn(async () => snapshot),
      put: vi.fn(async () => undefined),
    };
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const service = createLinkPreviewService({ fetchImpl, resolveHost: publicResolver(), cache });
    await expect(service.preview(snapshot.canonicalUrl)).resolves.toEqual(snapshot);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });
});

describe("Workers link preview cache", () => {
  it("stores snapshots on a deterministic internal cache URL", async () => {
    const storage = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (request: RequestInfo | URL) => {
        const key = typeof request === "string" ? request : request.toString();
        return storage.get(key)?.clone();
      }),
      put: vi.fn(async (request: RequestInfo | URL, response: Response) => {
        const key = typeof request === "string" ? request : request.toString();
        storage.set(key, response.clone());
      }),
    } as unknown as Cache;
    const adapter = createWorkersLinkPreviewCache(cache);
    const snapshot = {
      canonicalUrl: "https://example.com/cache-me",
      siteName: "Example",
      title: "Cache me",
      description: null,
      imageUrl: null,
      fetchedAt: 42,
      metadataStatus: "PARTIAL" as const,
    };
    await adapter.put(snapshot.canonicalUrl, snapshot, 21600);
    await expect(adapter.get(snapshot.canonicalUrl)).resolves.toEqual(snapshot);
    expect(cache.put).toHaveBeenCalledTimes(1);
    const key = String((cache.put as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]);
    expect(key).toContain("https://sourceboard.invalid/__link-preview-cache/");
  });
});

describe("link preview API route", () => {
  const apiSource = read("../../worker/comments/api.ts");
  const routeGuard = apiSource.slice(
    apiSource.indexOf("function isCommentRoute"),
    apiSource.indexOf("type KlipyMediaKind"),
  );

  it("recognizes and handles the authenticated composer endpoint before dynamic comment routes", () => {
    expect(routeGuard).toContain('pathname === "/api/comments/link-preview"');
    const handler = apiSource.indexOf('url.pathname === "/api/comments/link-preview"');
    const dynamicRoute = apiSource.indexOf("const commentMatch");
    expect(handler).toBeGreaterThan(-1);
    expect(handler).toBeLessThan(dynamicRoute);
    expect(apiSource).toContain("mutationSecurity(request)");
    expect(apiSource).toContain("await requiredViewer(request, env)");
  });

  it("uses preview-specific rate limiting and the safe fetch/cache service", () => {
    expect(apiSource).toContain(
      "`link-preview:${userId}:${getRequestSecurityContext(request).ipPrefixHash}`",
    );
    expect(apiSource).toContain("LINK_PREVIEW_RATE_LIMITED");
    expect(apiSource).toContain("LINK_PREVIEW_RATE_LIMIT_UNAVAILABLE");
    expect(apiSource).toContain("createLinkPreviewService");
    expect(apiSource).toContain("createWorkersLinkPreviewCache");
    expect(apiSource).toContain("resolveLinkPreviewHost");
  });

  it("does not expose the remote metadata image in the advisory response", () => {
    const handlerStart = apiSource.indexOf('url.pathname === "/api/comments/link-preview"');
    const handlerEnd = apiSource.indexOf("const commentService", handlerStart);
    const handler = apiSource.slice(handlerStart, handlerEnd);
    expect(handler).toContain("canonicalUrl");
    expect(handler).toContain("metadataStatus");
    expect(handler).not.toContain("imageUrl: preview.imageUrl");
  });
});
