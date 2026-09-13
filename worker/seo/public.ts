import { SUPPORTED_LOCALES, type Locale } from "../../shared/i18n/locales";
import { POST_CATEGORIES } from "../../shared/posts/categories";
import { absoluteSourceBoardUrl } from "../../shared/seo/urls";
import type { SourceBoardEnvironment } from "../environment";
import {
  createD1SitemapStore,
  SITEMAP_PAGE_SIZE,
  type SitemapPageEntry,
} from "./sitemap-store";

const CACHE_CONTROL = "public, max-age=300, s-maxage=300";
const CACHE_NAMESPACE = "seo:v3:";
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

interface CmsSitemapRow {
  locale: Locale;
  namespace: "DOCS" | "LEGAL" | "PAGE";
  slug: string;
  published_at: number | null;
  revision_created_at: number;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": CACHE_CONTROL,
    },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": CACHE_CONTROL,
    },
  });
}

function unavailableResponse(): Response {
  return new Response("SEO resources are temporarily unavailable.", {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function renderUrlSet(entries: SitemapPageEntry[]): string {
  const urls = entries
    .map(
      ({ loc, lastmod }) =>
        `<url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}</url>`,
    )
    .join("");
  return `${XML_HEADER}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

function renderSitemapIndex(entries: SitemapPageEntry[]): string {
  return `${XML_HEADER}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries
    .map(({ loc }) => `<sitemap><loc>${escapeXml(loc)}</loc></sitemap>`)
    .join("")}</sitemapindex>`;
}

function parsePage(pathname: string, kind: "posts" | "profiles"): number | null {
  const match = pathname.match(new RegExp(`^/sitemaps/${kind}-(\\d+)\\.xml$`));
  if (!match) return null;
  const page = Number(match[1]);
  return Number.isSafeInteger(page) && page >= 1 ? page : null;
}

async function readCache(env: SourceBoardEnvironment, pathname: string): Promise<string | null> {
  if (!env.CACHE) return null;
  return env.CACHE.get(`${CACHE_NAMESPACE}${pathname}`);
}

async function writeCache(
  env: SourceBoardEnvironment,
  pathname: string,
  body: string,
): Promise<void> {
  if (!env.CACHE) return;
  await env.CACHE.put(`${CACHE_NAMESPACE}${pathname}`, body, { expirationTtl: 300 });
}

function categorySitemapEntries(): SitemapPageEntry[] {
  return SUPPORTED_LOCALES.flatMap((locale) => [
    { loc: absoluteSourceBoardUrl(`/${locale}/category`) },
    ...POST_CATEGORIES.map((category) => ({
      loc: absoluteSourceBoardUrl(`/${locale}/category/${encodeURIComponent(category.slug)}`),
    })),
  ]);
}

function staticOfficialEntries(): SitemapPageEntry[] {
  return SUPPORTED_LOCALES.flatMap((locale) => [
    { loc: absoluteSourceBoardUrl(`/${locale}`) },
    { loc: absoluteSourceBoardUrl(`/${locale}/store`) },
  ]).concat([
    { loc: absoluteSourceBoardUrl("/en/docs") },
    { loc: absoluteSourceBoardUrl("/en/legal") },
  ]);
}

function cmsPath(row: CmsSitemapRow): string {
  const segment = row.namespace === "DOCS" ? "docs" : row.namespace === "LEGAL" ? "legal" : "pages";
  return `/${row.locale}/${segment}/${encodeURIComponent(row.slug)}`;
}

export async function listOfficialSitemapEntries(db: D1Database | null): Promise<SitemapPageEntry[]> {
  const entries = new Map<string, SitemapPageEntry>();
  for (const entry of staticOfficialEntries()) entries.set(entry.loc, entry);
  if (!db) return [...entries.values()];

  const rows = await db
    .prepare(
      `SELECT r.locale, r.namespace, r.slug, s.published_at, rev.created_at AS revision_created_at
       FROM cms_page_locale_state s
       JOIN cms_page_revisions rev ON rev.id = s.published_revision_id
       JOIN cms_page_routes r
         ON r.page_id = s.page_id
        AND r.locale = s.locale
        AND r.is_current = 1
       WHERE s.status = 'PUBLISHED'
         AND s.published_revision_id IS NOT NULL
       ORDER BY r.locale ASC, r.namespace ASC, r.slug ASC
       LIMIT ?`,
    )
    .bind(SITEMAP_PAGE_SIZE)
    .all<CmsSitemapRow>();

  for (const row of rows.results) {
    const loc = absoluteSourceBoardUrl(cmsPath(row));
    entries.set(loc, {
      loc,
      lastmod: row.published_at ?? row.revision_created_at,
    });
  }
  return [...entries.values()].slice(0, SITEMAP_PAGE_SIZE);
}

async function sitemapIndex(db: D1Database): Promise<string> {
  const store = createD1SitemapStore(db);
  const [postCount, profileCount] = await Promise.all([store.countPosts(), store.countProfiles()]);
  const entries: SitemapPageEntry[] = [
    { loc: absoluteSourceBoardUrl("/sitemaps/official-1.xml") },
    { loc: absoluteSourceBoardUrl("/sitemaps/categories.xml") },
  ];
  const postPages = Math.ceil(postCount / SITEMAP_PAGE_SIZE);
  const profilePages = Math.ceil(profileCount / SITEMAP_PAGE_SIZE);
  for (let page = 1; page <= postPages; page += 1) {
    entries.push({ loc: absoluteSourceBoardUrl(`/sitemaps/posts-${page}.xml`) });
  }
  for (let page = 1; page <= profilePages; page += 1) {
    entries.push({ loc: absoluteSourceBoardUrl(`/sitemaps/profiles-${page}.xml`) });
  }
  return renderSitemapIndex(entries);
}

function robots(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin/",
    "Disallow: /settings",
    "Disallow: /notifications",
    "Disallow: /friends",
    "Disallow: /login",
    "Disallow: /register",
    "Disallow: /forgot-password",
    "Disallow: /verify-email",
    "Disallow: /store/create",
    "Disallow: /resources/",
    "Sitemap: https://srcboard.me/sitemap.xml",
    "",
  ].join("\n");
}

export async function handlePublicSeoRequest(
  request: Request,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  const isSeoPath =
    pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname.startsWith("/sitemaps/");
  if (!isSeoPath) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }

  if (pathname === "/robots.txt") {
    const body = robots();
    return request.method === "HEAD" ? textResponse("") : textResponse(body);
  }

  const cached = await readCache(env, pathname);
  if (cached !== null) {
    return request.method === "HEAD" ? xmlResponse("") : xmlResponse(cached);
  }

  if (pathname === "/sitemaps/categories.xml") {
    const body = renderUrlSet(categorySitemapEntries());
    await writeCache(env, pathname, body);
    return request.method === "HEAD" ? xmlResponse("") : xmlResponse(body);
  }

  if (pathname === "/sitemaps/official-1.xml") {
    const body = renderUrlSet(await listOfficialSitemapEntries(env.DB ?? null));
    await writeCache(env, pathname, body);
    return request.method === "HEAD" ? xmlResponse("") : xmlResponse(body);
  }

  if (!env.DB) return unavailableResponse();

  const store = createD1SitemapStore(env.DB);
  let body: string | null = null;
  if (pathname === "/sitemap.xml") {
    body = await sitemapIndex(env.DB);
  } else {
    const postPage = parsePage(pathname, "posts");
    const profilePage = parsePage(pathname, "profiles");
    if (postPage !== null) body = renderUrlSet(await store.listPostPage(postPage));
    else if (profilePage !== null) body = renderUrlSet(await store.listProfilePage(profilePage));
  }

  if (body === null) return new Response("Not found", { status: 404 });
  await writeCache(env, pathname, body);
  return request.method === "HEAD" ? xmlResponse("") : xmlResponse(body);
}
