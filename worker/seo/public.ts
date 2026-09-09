import type { SourceBoardEnvironment } from "../environment";

const BASE_URL = "https://srcboard.me";
const PAGE_SIZE = 1_000;
const CACHE_CONTROL = "public, max-age=300, s-maxage=300";
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

interface CountRow {
  count: number;
}

interface PostSitemapRow {
  id: string;
  slug: string;
  updated_at: number;
}

interface ProfileSitemapRow {
  username: string;
  updated_at: number;
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

function renderUrlSet(entries: Array<{ loc: string; lastmod?: number }>): string {
  const urls = entries
    .map(
      ({ loc, lastmod }) =>
        `<url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}</url>`,
    )
    .join("");
  return `${XML_HEADER}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

function renderSitemapIndex(entries: Array<{ loc: string }>): string {
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
  return env.CACHE.get(`seo:v1:${pathname}`);
}

async function writeCache(
  env: SourceBoardEnvironment,
  pathname: string,
  body: string,
): Promise<void> {
  if (!env.CACHE) return;
  await env.CACHE.put(`seo:v1:${pathname}`, body, { expirationTtl: 300 });
}

async function sitemapIndex(db: D1Database): Promise<string> {
  const [posts, profiles] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM posts p
         WHERE p.visibility = 'PUBLIC'
           AND p.deleted_at IS NULL
           AND p.hidden_at IS NULL
           AND p.archived_at IS NULL
           AND p.is_nsfw = 0`,
      )
      .first<CountRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM user_profiles up
         JOIN users u ON u.id = up.user_id
         WHERE up.profile_visibility = 'PUBLIC'
           AND u.status = 'ACTIVE'`,
      )
      .first<CountRow>(),
  ]);
  const entries = [{ loc: `${BASE_URL}/sitemaps/static.xml` }];
  const postPages = Math.ceil(Number(posts?.count ?? 0) / PAGE_SIZE);
  const profilePages = Math.ceil(Number(profiles?.count ?? 0) / PAGE_SIZE);
  for (let page = 1; page <= postPages; page += 1) {
    entries.push({ loc: `${BASE_URL}/sitemaps/posts-${page}.xml` });
  }
  for (let page = 1; page <= profilePages; page += 1) {
    entries.push({ loc: `${BASE_URL}/sitemaps/profiles-${page}.xml` });
  }
  return renderSitemapIndex(entries);
}

async function postSitemap(db: D1Database, page: number): Promise<string> {
  const offset = (page - 1) * PAGE_SIZE;
  const rows = await db
    .prepare(
      `SELECT p.id, p.slug, p.updated_at
       FROM posts p
       WHERE p.visibility = 'PUBLIC'
         AND p.deleted_at IS NULL
         AND p.hidden_at IS NULL
         AND p.archived_at IS NULL
         AND p.is_nsfw = 0
       ORDER BY p.updated_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(PAGE_SIZE, offset)
    .all<PostSitemapRow>();
  return renderUrlSet(
    rows.results.map((post) => ({
      loc: `${BASE_URL}/posts/${encodeURIComponent(post.id)}/${encodeURIComponent(post.slug)}`,
      lastmod: post.updated_at,
    })),
  );
}

async function profileSitemap(db: D1Database, page: number): Promise<string> {
  const offset = (page - 1) * PAGE_SIZE;
  const rows = await db
    .prepare(
      `SELECT u.username, up.updated_at
       FROM user_profiles up
       JOIN users u ON u.id = up.user_id
       WHERE up.profile_visibility = 'PUBLIC'
         AND u.status = 'ACTIVE'
       ORDER BY up.updated_at DESC, u.username ASC
       LIMIT ? OFFSET ?`,
    )
    .bind(PAGE_SIZE, offset)
    .all<ProfileSitemapRow>();
  return renderUrlSet(
    rows.results.map((profile) => ({
      loc: `${BASE_URL}/u/${encodeURIComponent(profile.username)}`,
      lastmod: profile.updated_at,
    })),
  );
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

  if (pathname === "/sitemaps/static.xml") {
    const body = renderUrlSet([
      { loc: `${BASE_URL}/` },
      { loc: `${BASE_URL}/docs` },
      { loc: `${BASE_URL}/legal` },
    ]);
    await writeCache(env, pathname, body);
    return request.method === "HEAD" ? xmlResponse("") : xmlResponse(body);
  }

  if (!env.DB) return unavailableResponse();

  let body: string | null = null;
  if (pathname === "/sitemap.xml") {
    body = await sitemapIndex(env.DB);
  } else {
    const postPage = parsePage(pathname, "posts");
    const profilePage = parsePage(pathname, "profiles");
    if (postPage !== null) body = await postSitemap(env.DB, postPage);
    else if (profilePage !== null) body = await profileSitemap(env.DB, profilePage);
  }

  if (body === null) return new Response("Not found", { status: 404 });
  await writeCache(env, pathname, body);
  return request.method === "HEAD" ? xmlResponse("") : xmlResponse(body);
}
