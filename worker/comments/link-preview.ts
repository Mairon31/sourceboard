import { PostError } from "../posts/errors";
import type { CommentLinkPreviewSnapshot } from "./types";

export type LinkPreviewSnapshot = CommentLinkPreviewSnapshot;

export interface LinkPreviewDependencies {
  fetchImpl: typeof fetch;
  resolveHost: (hostname: string) => Promise<string[]>;
  cache?: {
    get(url: string): Promise<LinkPreviewSnapshot | null>;
    put(url: string, value: LinkPreviewSnapshot, ttlSeconds: number): Promise<void>;
  };
  now?: () => number;
}

const MAX_URL_LENGTH = 2048;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 5000;
const CACHE_TTL_SECONDS = 21600;
const MAX_CNAME_DEPTH = 4;

function linkError(status: number, code: string, message: string): PostError {
  return new PostError(status, code, message);
}

function parseIpv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const number = Number(part);
    if (!Number.isInteger(number) || number < 0 || number > 255) return null;
    numbers.push(number);
  }
  return numbers;
}

function parseIpv6(value: string): number[] | null {
  let input = value.toLowerCase();
  if (input.startsWith("[") && input.endsWith("]")) input = input.slice(1, -1);
  if (!input || input.includes("%")) return null;

  let ipv4Tail: number[] = [];
  const lastColon = input.lastIndexOf(":");
  const tail = lastColon >= 0 ? input.slice(lastColon + 1) : input;
  if (tail.includes(".")) {
    const ipv4 = parseIpv4(tail);
    if (!ipv4) return null;
    ipv4Tail = [(ipv4[0]! << 8) | ipv4[1]!, (ipv4[2]! << 8) | ipv4[3]!];
    input = `${input.slice(0, lastColon)}:v4`;
  }

  if ((input.match(/::/g) ?? []).length > 1) return null;
  const hasCompression = input.includes("::");
  const [leftText, rightText = ""] = input.split("::");
  const parseSide = (side: string): number[] | null => {
    if (!side) return [];
    const values: number[] = [];
    for (const part of side.split(":")) {
      if (part === "v4") {
        values.push(...ipv4Tail);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      values.push(Number.parseInt(part, 16));
    }
    return values;
  };
  const left = parseSide(leftText ?? "");
  const right = parseSide(rightText);
  if (!left || !right) return null;
  const explicit = left.length + right.length;
  if (hasCompression) {
    if (explicit >= 8) return null;
    return [...left, ...Array(8 - explicit).fill(0), ...right];
  }
  return explicit === 8 ? [...left, ...right] : null;
}

function ipv6Prefix(parts: number[], prefix: number[]): boolean {
  return prefix.every((value, index) => parts[index] === value);
}

export function isPublicIpAddress(value: string): boolean {
  const ipv4 = parseIpv4(value);
  if (ipv4) {
    const [a, b, c] = ipv4;
    if (a === 0 || a === 10 || a === 127 || a! >= 224) return false;
    if (a === 100 && b! >= 64 && b! <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b! >= 16 && b! <= 31) return false;
    if (a === 192 && b === 0 && c === 0) return false;
    if (a === 192 && b === 0 && c === 2) return false;
    if (a === 192 && b === 88 && c === 99) return false;
    if (a === 192 && b === 168) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }

  const ipv6 = parseIpv6(value);
  if (!ipv6) return false;
  if (ipv6.every((part) => part === 0)) return false;
  if (ipv6.slice(0, 7).every((part) => part === 0) && ipv6[7] === 1) return false;
  if ((ipv6[0]! & 0xfe00) === 0xfc00) return false;
  if ((ipv6[0]! & 0xffc0) === 0xfe80) return false;
  if ((ipv6[0]! & 0xffc0) === 0xfec0) return false;
  if ((ipv6[0]! & 0xff00) === 0xff00) return false;
  if (ipv6Prefix(ipv6, [0x2001, 0x0db8])) return false;
  if (ipv6.slice(0, 5).every((part) => part === 0) && ipv6[5] === 0xffff) return false;
  if (ipv6.slice(0, 6).every((part) => part === 0)) return false;
  return true;
}

function hostnameIpLiteral(hostname: string): string | null {
  const unwrapped =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  return parseIpv4(unwrapped) || parseIpv6(unwrapped) ? unwrapped : null;
}

export function normalizeLinkPreviewUrl(value: unknown): URL {
  if (typeof value !== "string" || !value.trim()) {
    throw linkError(400, "LINK_PREVIEW_INVALID_URL", "Enter a valid link.");
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw linkError(400, "LINK_PREVIEW_INVALID_URL", "Enter a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw linkError(
      400,
      "LINK_PREVIEW_UNSUPPORTED_PROTOCOL",
      "Only HTTP and HTTPS links are supported.",
    );
  }
  if (url.username || url.password) {
    throw linkError(
      400,
      "LINK_PREVIEW_CREDENTIALS_FORBIDDEN",
      "Links with embedded credentials are not supported.",
    );
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw linkError(400, "LINK_PREVIEW_PRIVATE_TARGET", "Private network links are not supported.");
  }
  const literal = hostnameIpLiteral(hostname);
  if (literal && !isPublicIpAddress(literal)) {
    throw linkError(400, "LINK_PREVIEW_PRIVATE_TARGET", "Private network links are not supported.");
  }
  url.hash = "";
  if (url.toString().length > MAX_URL_LENGTH) {
    throw linkError(400, "LINK_PREVIEW_URL_TOO_LONG", "The link is too long.");
  }
  return url;
}

interface DnsJsonAnswer {
  type?: number;
  data?: string;
}

interface DnsJsonResponse {
  Answer?: DnsJsonAnswer[];
}

async function queryDns(
  hostname: string,
  type: "A" | "AAAA",
  fetchImpl: typeof fetch,
): Promise<DnsJsonAnswer[]> {
  const url = new URL("https://cloudflare-dns.com/dns-query");
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", type);
  const response = await fetchImpl(url.toString(), {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("DNS lookup failed");
  const payload = (await response.json()) as DnsJsonResponse;
  return Array.isArray(payload.Answer) ? payload.Answer : [];
}

export async function resolveLinkPreviewHost(
  hostname: string,
  fetchImpl: typeof fetch = fetch,
  depth = 0,
): Promise<string[]> {
  if (depth > MAX_CNAME_DEPTH) throw new Error("CNAME depth exceeded");
  const literal = hostnameIpLiteral(hostname);
  if (literal) return [literal];
  const [aAnswers, aaaaAnswers] = await Promise.all([
    queryDns(hostname, "A", fetchImpl),
    queryDns(hostname, "AAAA", fetchImpl),
  ]);
  const answers = [...aAnswers, ...aaaaAnswers];
  const addresses = answers.flatMap((answer) => {
    if ((answer.type === 1 || answer.type === 28) && typeof answer.data === "string") {
      return [answer.data];
    }
    return [];
  });
  if (addresses.length) return [...new Set(addresses)];
  const cname = answers.find(
    (answer) => answer.type === 5 && typeof answer.data === "string",
  )?.data;
  if (!cname) return [];
  return resolveLinkPreviewHost(cname.replace(/\.$/, ""), fetchImpl, depth + 1);
}

async function assertPublicTarget(
  url: URL,
  resolveHost: (hostname: string) => Promise<string[]>,
): Promise<void> {
  const literal = hostnameIpLiteral(url.hostname);
  if (literal) {
    if (!isPublicIpAddress(literal)) {
      throw linkError(
        400,
        "LINK_PREVIEW_PRIVATE_TARGET",
        "Private network links are not supported.",
      );
    }
    return;
  }
  const addresses = await resolveHost(url.hostname);
  if (!addresses.length) throw new Error("Hostname did not resolve");
  if (addresses.some((address) => !isPublicIpAddress(address))) {
    throw linkError(400, "LINK_PREVIEW_PRIVATE_TARGET", "Private network links are not supported.");
  }
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (match, entity: string) => {
      const lower = entity.toLowerCase();
      if (lower.startsWith("#x")) {
        const code = Number.parseInt(lower.slice(2), 16);
        return Number.isSafeInteger(code) ? String.fromCodePoint(code) : match;
      }
      if (lower.startsWith("#")) {
        const code = Number.parseInt(lower.slice(1), 10);
        return Number.isSafeInteger(code) ? String.fromCodePoint(code) : match;
      }
      return named[lower] ?? match;
    },
  );
}

function cleanMetadata(value: string | null, max: number): string | null {
  if (!value) return null;
  const cleaned = decodeEntities(value)
    .replace(/<[^>]*>/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return Array.from(cleaned).slice(0, max).join("");
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (name) attributes[name] = value;
  }
  return attributes;
}

function metadataValues(html: string): {
  title: string | null;
  description: string | null;
  siteName: string | null;
  image: string | null;
} {
  let ogTitle: string | null = null;
  let description: string | null = null;
  let ogDescription: string | null = null;
  let siteName: string | null = null;
  let ogImage: string | null = null;
  let twitterImage: string | null = null;
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const key = (attributes.property ?? attributes.name ?? "").toLowerCase();
    const content = attributes.content ?? null;
    if (!content) continue;
    if (key === "og:title" && !ogTitle) ogTitle = content;
    else if (key === "og:description" && !ogDescription) ogDescription = content;
    else if (key === "description" && !description) description = content;
    else if (key === "og:site_name" && !siteName) siteName = content;
    else if (key === "og:image" && !ogImage) ogImage = content;
    else if (key === "twitter:image" && !twitterImage) twitterImage = content;
  }
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  return {
    title: cleanMetadata(ogTitle ?? titleMatch?.[1] ?? null, 160),
    description: cleanMetadata(ogDescription ?? description, 320),
    siteName: cleanMetadata(siteName, 80),
    image: cleanMetadata(ogImage ?? twitterImage, MAX_URL_LENGTH),
  };
}

async function readBoundedText(response: Response, maximumBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maximumBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      const remaining = maximumBytes - total;
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.byteLength;
      if (value.byteLength > remaining || total >= maximumBytes) {
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function urlOnly(url: URL, fetchedAt: number): LinkPreviewSnapshot {
  return {
    canonicalUrl: url.toString(),
    siteName: null,
    title: null,
    description: null,
    imageUrl: null,
    fetchedAt,
    metadataStatus: "URL_ONLY",
  };
}

function shouldPropagate(error: unknown): boolean {
  return (
    error instanceof PostError &&
    (error.code === "LINK_PREVIEW_PRIVATE_TARGET" ||
      error.code === "LINK_PREVIEW_TOO_MANY_REDIRECTS" ||
      error.code === "LINK_PREVIEW_INVALID_REDIRECT")
  );
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export function createLinkPreviewService(dependencies: LinkPreviewDependencies) {
  const now = dependencies.now ?? (() => Date.now());
  return {
    async preview(value: unknown): Promise<LinkPreviewSnapshot> {
      const initial = normalizeLinkPreviewUrl(value);
      const cacheKey = initial.toString();
      try {
        const cached = await dependencies.cache?.get(cacheKey);
        if (cached) return cached;
      } catch {
        // Cache failure must not make preview generation unavailable.
      }

      let current = initial;
      try {
        for (let redirects = 0; ; redirects += 1) {
          await assertPublicTarget(current, dependencies.resolveHost);
          const response = await dependencies.fetchImpl(current.toString(), {
            redirect: "manual",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: {
              accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
              "user-agent": "SourceBoard-LinkPreview/1.0",
            },
          });
          if (isRedirect(response.status)) {
            if (redirects >= MAX_REDIRECTS) {
              throw linkError(
                400,
                "LINK_PREVIEW_TOO_MANY_REDIRECTS",
                "The link redirects too many times.",
              );
            }
            const location = response.headers.get("location");
            if (!location) return urlOnly(current, now());
            let redirected: URL;
            try {
              redirected = normalizeLinkPreviewUrl(new URL(location, current).toString());
            } catch (error) {
              if (error instanceof PostError && error.code === "LINK_PREVIEW_PRIVATE_TARGET")
                throw error;
              throw linkError(
                400,
                "LINK_PREVIEW_INVALID_REDIRECT",
                "The link redirects to an invalid address.",
              );
            }
            current = redirected;
            continue;
          }

          const fetchedAt = now();
          const contentType = response.headers
            .get("content-type")
            ?.split(";", 1)[0]
            ?.trim()
            .toLowerCase();
          if (
            !response.ok ||
            (contentType !== "text/html" && contentType !== "application/xhtml+xml")
          ) {
            const snapshot = urlOnly(current, fetchedAt);
            try {
              await dependencies.cache?.put(cacheKey, snapshot, CACHE_TTL_SECONDS);
            } catch {
              // Cache writes are advisory.
            }
            return snapshot;
          }

          const html = await readBoundedText(response, MAX_HTML_BYTES);
          const metadata = metadataValues(html);
          let imageUrl: string | null = null;
          if (metadata.image) {
            try {
              imageUrl = normalizeLinkPreviewUrl(
                new URL(metadata.image, current).toString(),
              ).toString();
            } catch {
              imageUrl = null;
            }
          }
          const present = [
            metadata.title,
            metadata.description,
            metadata.siteName,
            imageUrl,
          ].filter(Boolean).length;
          const snapshot: LinkPreviewSnapshot = {
            canonicalUrl: current.toString(),
            siteName: metadata.siteName,
            title: metadata.title,
            description: metadata.description,
            imageUrl,
            fetchedAt,
            metadataStatus: present === 0 ? "URL_ONLY" : present >= 3 ? "COMPLETE" : "PARTIAL",
          };
          try {
            await dependencies.cache?.put(cacheKey, snapshot, CACHE_TTL_SECONDS);
          } catch {
            // Cache writes are advisory.
          }
          return snapshot;
        }
      } catch (error) {
        if (shouldPropagate(error)) throw error;
        const snapshot = urlOnly(current, now());
        try {
          await dependencies.cache?.put(cacheKey, snapshot, CACHE_TTL_SECONDS);
        } catch {
          // Cache writes are advisory.
        }
        return snapshot;
      }
    },
  };
}

async function cacheKey(canonicalUrl: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalUrl));
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `https://sourceboard.invalid/__link-preview-cache/${hash}`;
}

export function createWorkersLinkPreviewCache(cache: Cache) {
  return {
    async get(url: string): Promise<LinkPreviewSnapshot | null> {
      const response = await cache.match(await cacheKey(url));
      if (!response?.ok) return null;
      try {
        return (await response.json()) as LinkPreviewSnapshot;
      } catch {
        return null;
      }
    },
    async put(url: string, value: LinkPreviewSnapshot, ttlSeconds: number): Promise<void> {
      const key = await cacheKey(url);
      await cache.put(
        key,
        new Response(JSON.stringify(value), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": `max-age=${Math.max(0, Math.floor(ttlSeconds))}`,
          },
        }),
      );
    },
  };
}

// Workers cannot pin the hostname fetch to the DNS address checked immediately beforehand.
// Re-resolving every hop, validating all returned addresses, blocking local/literal targets and
// following redirects manually reduces DNS-rebinding exposure, but it is not perfect prevention.
