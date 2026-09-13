import { describe, expect, it, vi } from "vitest";
import { createLinkPreviewService } from "../../worker/comments/link-preview";

const publicResolver = vi.fn(async () => ["93.184.216.34"]);

function htmlResponse() {
  return new Response(
    `<!doctype html><html><head><meta property="og:title" content="Spirited Away"><meta property="og:description" content="A young girl enters a world ruled by gods, witches and spirits."><meta property="og:site_name" content="IMDb"></head></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

describe("link preview compatibility", () => {
  it("retries a bot-blocked HTML metadata request with browser-compatible headers", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const userAgent = new Headers(init?.headers).get("user-agent") ?? "";
      return userAgent.includes("SourceBoard-LinkPreview")
        ? new Response("Forbidden", { status: 403, headers: { "content-type": "text/html" } })
        : htmlResponse();
    }) as unknown as typeof fetch;
    const service = createLinkPreviewService({ fetchImpl, resolveHost: publicResolver, now: () => 10_000 });

    await expect(service.preview("https://www.imdb.com/title/tt0245429/")).resolves.toMatchObject({
      title: "Spirited Away",
      description: "A young girl enters a world ruled by gods, witches and spirits.",
      siteName: "IMDb",
      metadataStatus: "COMPLETE",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not let a stale URL-only cache entry permanently suppress metadata recovery", async () => {
    const cached = {
      canonicalUrl: "https://example.com/old",
      siteName: null,
      title: null,
      description: null,
      imageUrl: null,
      fetchedAt: 0,
      metadataStatus: "URL_ONLY" as const,
    };
    const cache = {
      get: vi.fn(async () => cached),
      put: vi.fn(async () => undefined),
    };
    const fetchImpl = vi.fn(async () => htmlResponse()) as unknown as typeof fetch;
    const service = createLinkPreviewService({
      fetchImpl,
      resolveHost: publicResolver,
      cache,
      now: () => 10 * 60 * 1000,
    });

    await expect(service.preview(cached.canonicalUrl)).resolves.toMatchObject({
      title: "Spirited Away",
      metadataStatus: "COMPLETE",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
