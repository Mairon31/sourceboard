import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  createLinkPreviewService,
  createWorkersLinkPreviewCache,
  fetchPreviewImage,
  isPublicIpAddress,
  normalizeLinkPreviewUrl,
  resolveLinkPreviewHost,
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

  it("invokes the injected fetch with the global receiver used by Workers", async () => {
    const fetchImpl = vi.fn(async function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return new Response("<title>Bound fetch</title>", {
        headers: { "content-type": "text/html" },
      });
    }) as unknown as typeof fetch;
    const service = createLinkPreviewService({ fetchImpl, resolveHost: publicResolver() });

    await expect(service.preview("https://example.com/bound-fetch")).resolves.toMatchObject({
      title: "Bound fetch",
      metadataStatus: "MINIMAL",
    });
  });

  it("keeps the global receiver while resolving preview DNS", async () => {
    const fetchImpl = vi.fn(async function (this: unknown, input: RequestInfo | URL) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      const url = new URL(String(input));
      return new Response(
        JSON.stringify({
          Answer: url.searchParams.get("type") === "A" ? [{ type: 1, data: "93.184.216.34" }] : [],
        }),
      );
    }) as unknown as typeof fetch;

    await expect(resolveLinkPreviewHost("example.com", fetchImpl)).resolves.toEqual([
      "93.184.216.34",
    ]);
  });

  it("retries a blocked public document and classifies title-only metadata as MINIMAL", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(
        new Response('<meta property="og:title" content="Recovered">', {
          headers: { "content-type": "text/html" },
        }),
      ) as unknown as typeof fetch;
    const resolveHost = vi.fn(async () => ["93.184.216.34"]);
    const service = createLinkPreviewService({ fetchImpl, resolveHost });

    await expect(service.preview("https://www.imdb.com/title/tt0245429/")).resolves.toMatchObject({
      title: "Recovered",
      metadataStatus: "MINIMAL",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(resolveHost).toHaveBeenCalledTimes(2);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({ "user-agent": expect.stringContaining("Mozilla/") }),
    });
  });

  it("recovers safe IMDb title metadata when the title page returns an AWS WAF challenge", async () => {
    const titleUrl = "https://www.imdb.com/title/tt0245429/";
    const imageUrl = "https://m.media-amazon.com/images/M/example.jpg";
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === titleUrl) {
        return new Response(
          '<html><script>window.gokuProps={};</script><script src="challenge.js"></script><div id="challenge-container"></div></html>',
          { status: 202, headers: { "content-type": "text/html; charset=UTF-8" } },
        );
      }
      if (url === "https://v2.sg.media-imdb.com/suggestion/x/tt0245429.json") {
        return new Response(
          JSON.stringify({
            d: [{ id: "tt0245429", l: "Spirited Away", i: { imageUrl, width: 200, height: 300 } }],
          }),
          { headers: { "content-type": "application/json; charset=utf-8" } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;
    const resolveHost = vi.fn(async () => ["93.184.216.34"]);
    const service = createLinkPreviewService({ fetchImpl, resolveHost });

    await expect(service.preview(titleUrl)).resolves.toMatchObject({
      canonicalUrl: titleUrl,
      siteName: "IMDb",
      title: "Spirited Away",
      description: null,
      imageUrl,
      metadataStatus: "COMPLETE",
    });
    expect(
      (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([input]) => String(input)),
    ).toEqual([titleUrl, "https://v2.sg.media-imdb.com/suggestion/x/tt0245429.json"]);
  });

  it("recognizes challenge markers even when the upstream returns HTTP 200", async () => {
    const titleUrl = "https://www.imdb.com/title/tt0245429/";
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === titleUrl) {
        return new Response(
          '<html><script>window.gokuProps={};</script><div id="challenge-container"></div></html>',
          { headers: { "content-type": "text/html" } },
        );
      }
      if (url === "https://v2.sg.media-imdb.com/suggestion/x/tt0245429.json") {
        return new Response(JSON.stringify({ d: [{ id: "tt0245429", l: "Spirited Away" }] }), {
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;
    const service = createLinkPreviewService({ fetchImpl, resolveHost: publicResolver() });

    await expect(service.preview(titleUrl)).resolves.toMatchObject({
      title: "Spirited Away",
      metadataStatus: "COMPLETE",
    });
  });

  it("uses the IMDb suggestion endpoint when a challenge has no readable body", async () => {
    const titleUrl = "https://www.imdb.com/title/tt0245429/";
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === titleUrl) return new Response(null, { status: 202 });
      if (url === "https://v2.sg.media-imdb.com/suggestion/x/tt0245429.json") {
        return new Response(JSON.stringify({ d: [{ id: "tt0245429", l: "Spirited Away" }] }), {
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;
    const service = createLinkPreviewService({ fetchImpl, resolveHost: publicResolver() });

    await expect(service.preview(titleUrl)).resolves.toMatchObject({
      title: "Spirited Away",
      metadataStatus: "COMPLETE",
    });
  });

  it("falls back to structured IMDb metadata when the title document is empty", async () => {
    const titleUrl = "https://www.imdb.com/title/tt0245429/";
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === titleUrl) {
        return new Response("<html><head></head><body>JavaScript app shell</body></html>", {
          headers: { "content-type": "text/html" },
        });
      }
      if (url === "https://v2.sg.media-imdb.com/suggestion/x/tt0245429.json") {
        return new Response(JSON.stringify({ d: [{ id: "tt0245429", l: "Spirited Away" }] }), {
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;
    const service = createLinkPreviewService({ fetchImpl, resolveHost: publicResolver() });

    await expect(service.preview(titleUrl)).resolves.toMatchObject({
      title: "Spirited Away",
      metadataStatus: "COMPLETE",
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

  it("preserves a submitted profile path when upstream canonical metadata collapses to the host root", async () => {
    const submittedUrl = "https://www.instagram.com/itshannahowo";
    const html = `<!doctype html><html><head>
      <link rel="canonical" href="https://www.instagram.com/">
      <meta property="og:title" content="Hannah (@itshannahowo)">
    </head></html>`;
    const service = createLinkPreviewService({
      fetchImpl: vi.fn(
        async () => new Response(html, { headers: { "content-type": "text/html" } }),
      ) as unknown as typeof fetch,
      resolveHost: publicResolver(),
    });

    await expect(service.preview(submittedUrl)).resolves.toMatchObject({
      canonicalUrl: submittedUrl,
      title: "Hannah (@itshannahowo)",
    });
  });

  it("does not reuse a cached preview whose canonical URL already lost the submitted path", async () => {
    const submittedUrl = "https://www.instagram.com/itshannahowo";
    const cache = {
      get: vi.fn(async () => ({
        canonicalUrl: "https://www.instagram.com/",
        siteName: "Instagram",
        title: "Hannah (@itshannahowo)",
        description: null,
        imageUrl: null,
        fetchedAt: 1,
        metadataStatus: "COMPLETE" as const,
      })),
      put: vi.fn(async () => undefined),
    };
    const fetchImpl = vi.fn(
      async () =>
        new Response("<title>Hannah (@itshannahowo)</title>", {
          headers: { "content-type": "text/html" },
        }),
    ) as unknown as typeof fetch;
    const service = createLinkPreviewService({
      fetchImpl,
      resolveHost: publicResolver(),
      cache,
    });

    await expect(service.preview(submittedUrl)).resolves.toMatchObject({
      canonicalUrl: submittedUrl,
    });
    expect(cache.get).toHaveBeenCalledWith(submittedUrl);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("falls back when a higher-priority metadata tag is blank after cleaning", async () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="   ">
      <meta name="twitter:title" content="Twitter fallback">
      <title>HTML title fallback</title>
      <meta property="og:description" content="&#160;">
      <meta name="twitter:description" content="Twitter description fallback">
      <meta name="description" content="HTML description fallback">
    </head></html>`;
    const service = createLinkPreviewService({
      fetchImpl: vi.fn(
        async () => new Response(html, { headers: { "content-type": "text/html" } }),
      ) as unknown as typeof fetch,
      resolveHost: publicResolver(),
    });

    await expect(service.preview("https://example.com/fallbacks")).resolves.toMatchObject({
      title: "Twitter fallback",
      description: "Twitter description fallback",
      metadataStatus: "COMPLETE",
    });
  });

  it("classifies rich, partial, minimal and URL-only metadata consistently", async () => {
    const preview = async (html: string) => {
      const service = createLinkPreviewService({
        fetchImpl: vi.fn(
          async () => new Response(html, { headers: { "content-type": "text/html" } }),
        ) as unknown as typeof fetch,
        resolveHost: publicResolver(),
      });
      return service.preview("https://example.com/status");
    };

    await expect(
      preview('<title>Rich title</title><meta name="description" content="Rich description">'),
    ).resolves.toMatchObject({ metadataStatus: "COMPLETE" });
    await expect(
      preview(
        '<meta property="og:description" content="Useful"><meta property="og:site_name" content="Example">',
      ),
    ).resolves.toMatchObject({ metadataStatus: "PARTIAL" });
    await expect(preview("<title>Only title</title>")).resolves.toMatchObject({
      metadataStatus: "MINIMAL",
    });
    await expect(preview("<html><head></head></html>")).resolves.toMatchObject({
      metadataStatus: "URL_ONLY",
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

  it("bypasses cached URL-only snapshots so stale previews can retry", async () => {
    const cachedUrlOnly = {
      canonicalUrl: "https://example.com/stale",
      siteName: null,
      title: null,
      description: null,
      imageUrl: null,
      fetchedAt: 10,
      metadataStatus: "URL_ONLY" as const,
    };
    const fetchImpl = vi.fn(
      async () =>
        new Response("<title>Recovered title</title>", {
          headers: { "content-type": "text/html" },
        }),
    ) as unknown as typeof fetch;
    const cache = {
      get: vi.fn(async () => cachedUrlOnly),
      put: vi.fn(async () => undefined),
    };
    const service = createLinkPreviewService({
      fetchImpl,
      resolveHost: publicResolver(),
      cache,
      now: () => 100,
    });

    await expect(service.preview(cachedUrlOnly.canonicalUrl)).resolves.toMatchObject({
      title: "Recovered title",
      metadataStatus: "MINIMAL",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not cache URL-only snapshots", async () => {
    const cache = {
      get: vi.fn(async () => null),
      put: vi.fn(async () => undefined),
    };
    const fetchImpl = vi.fn(
      async () =>
        new Response("<html><head></head></html>", {
          headers: { "content-type": "text/html" },
        }),
    ) as unknown as typeof fetch;
    const service = createLinkPreviewService({
      fetchImpl,
      resolveHost: publicResolver(),
      cache,
      now: () => 100,
    });

    await expect(service.preview("https://example.com/no-metadata")).resolves.toMatchObject({
      metadataStatus: "URL_ONLY",
    });
    expect(cache.put).not.toHaveBeenCalled();
  });
});

describe("persisted link preview image fetcher", () => {
  it("returns a bounded supported image", async () => {
    const body = new Uint8Array([1, 2, 3, 4]);
    const fetchImpl = vi.fn(async function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return new Response(body, { headers: { "content-type": "image/png" } });
    }) as unknown as typeof fetch;
    const image = await fetchPreviewImage("https://example.com/preview.png", {
      fetchImpl,
      resolveHost: publicResolver(),
    });
    expect(image.contentType).toBe("image/png");
    expect(Array.from(new Uint8Array(image.body))).toEqual([1, 2, 3, 4]);
  });

  it("revalidates image redirects and rejects private targets", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: "http://127.0.0.1/a.png" } }),
    ) as unknown as typeof fetch;
    await expect(
      fetchPreviewImage("https://example.com/preview.png", {
        fetchImpl,
        resolveHost: publicResolver(),
      }),
    ).rejects.toMatchObject({ code: "LINK_PREVIEW_PRIVATE_TARGET" });
  });

  it("rejects preview images larger than 2 MiB", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(new Uint8Array([1]), {
          headers: { "content-type": "image/webp", "content-length": String(2 * 1024 * 1024 + 1) },
        }),
    ) as unknown as typeof fetch;
    await expect(
      fetchPreviewImage("https://example.com/preview.webp", {
        fetchImpl,
        resolveHost: publicResolver(),
      }),
    ).rejects.toMatchObject({ code: "LINK_PREVIEW_IMAGE_TOO_LARGE" });
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

  it("denies the persisted image proxy when the comment is not visible", () => {
    const imageStart = apiSource.indexOf("const previewImageMatch");
    const imageEnd = apiSource.indexOf("const commentService", imageStart);
    const imageHandler = apiSource.slice(imageStart, imageEnd);
    expect(imageHandler).toContain('comment.comment.state !== "VISIBLE"');
  });
});
