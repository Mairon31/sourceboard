import { describe, expect, it, vi } from "vitest";
import { createLinkPreviewService } from "../../worker/comments/link-preview";

function resolverFor(hosts: Record<string, string[]> = {}) {
  return vi.fn(async (hostname: string) => hosts[hostname] ?? ["93.184.216.34"]);
}

function htmlResponse(html: string) {
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

describe("link preview metadata contract", () => {
  it("falls back to Twitter title and description metadata", async () => {
    const service = createLinkPreviewService({
      fetchImpl: vi.fn(async () => htmlResponse(`<!doctype html><head>
        <meta name="twitter:title" content="Twitter title">
        <meta name="twitter:description" content="Twitter description">
      </head>`)) as unknown as typeof fetch,
      resolveHost: resolverFor(),
      now: () => 10,
    });

    await expect(service.preview("https://example.com/story")).resolves.toMatchObject({
      title: "Twitter title",
      description: "Twitter description",
      metadataStatus: "COMPLETE",
    });
  });

  it("adopts a safe relative canonical URL after validating its target", async () => {
    const resolveHost = resolverFor();
    const service = createLinkPreviewService({
      fetchImpl: vi.fn(async () => htmlResponse(`<!doctype html><head>
        <link rel="canonical" href="/canonical-story">
        <meta property="og:title" content="Canonical story">
      </head>`)) as unknown as typeof fetch,
      resolveHost,
      now: () => 20,
    });

    await expect(service.preview("https://example.com/story?tracking=1")).resolves.toMatchObject({
      canonicalUrl: "https://example.com/canonical-story",
      title: "Canonical story",
    });
    expect(resolveHost).toHaveBeenCalledWith("example.com");
  });

  it("ignores a canonical URL whose hostname resolves privately", async () => {
    const resolveHost = resolverFor({ "private.example": ["192.168.1.5"] });
    const service = createLinkPreviewService({
      fetchImpl: vi.fn(async () => htmlResponse(`<!doctype html><head>
        <link rel="canonical" href="https://private.example/internal">
        <meta property="og:title" content="Public story">
      </head>`)) as unknown as typeof fetch,
      resolveHost,
      now: () => 30,
    });

    await expect(service.preview("https://example.com/story")).resolves.toMatchObject({
      canonicalUrl: "https://example.com/story",
      title: "Public story",
    });
    expect(resolveHost).toHaveBeenCalledWith("private.example");
  });

  it("classifies a single useful metadata field as MINIMAL", async () => {
    const service = createLinkPreviewService({
      fetchImpl: vi.fn(async () => htmlResponse('<meta property="og:title" content="Only title">')) as unknown as typeof fetch,
      resolveHost: resolverFor(),
      now: () => 40,
    });

    await expect(service.preview("https://example.com/minimal")).resolves.toMatchObject({
      title: "Only title",
      metadataStatus: "MINIMAL",
    });
  });

  it("keeps metadata truncation Unicode-safe", async () => {
    const title = "😀".repeat(170);
    const description = "界".repeat(340);
    const service = createLinkPreviewService({
      fetchImpl: vi.fn(async () => htmlResponse(`
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="${description}">
      `)) as unknown as typeof fetch,
      resolveHost: resolverFor(),
    });

    const preview = await service.preview("https://example.com/unicode");
    expect(Array.from(preview.title ?? "")).toHaveLength(160);
    expect(Array.from(preview.description ?? "")).toHaveLength(320);
    expect(preview.title?.endsWith("😀")).toBe(true);
  });
});
