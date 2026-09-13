import { canonicalPostUrl, canonicalProfileUrl } from "../../shared/seo/urls";

export const SITEMAP_PAGE_SIZE = 1_000;

export type SitemapKind = "posts" | "profiles" | "categories" | "official";

export interface SitemapPageEntry {
  loc: string;
  lastmod?: number;
}

export interface SitemapStore {
  countPosts(): Promise<number>;
  listPostPage(page: number): Promise<SitemapPageEntry[]>;
  countProfiles(): Promise<number>;
  listProfilePage(page: number): Promise<SitemapPageEntry[]>;
}

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

const POST_PUBLIC_PREDICATE = `p.visibility = 'PUBLIC'
  AND p.deleted_at IS NULL
  AND p.hidden_at IS NULL
  AND p.archived_at IS NULL
  AND p.is_nsfw = 0`;

const PROFILE_PUBLIC_PREDICATE = `up.profile_visibility = 'PUBLIC'
  AND u.status = 'ACTIVE'`;

function validPage(page: number): boolean {
  return Number.isSafeInteger(page) && page >= 1;
}

export function createD1SitemapStore(db: D1Database): SitemapStore {
  return {
    async countPosts() {
      const row = await db
        .prepare(`SELECT COUNT(*) AS count FROM posts p WHERE ${POST_PUBLIC_PREDICATE}`)
        .first<CountRow>();
      return Number(row?.count ?? 0);
    },

    async listPostPage(page) {
      if (!validPage(page)) return [];
      let cursorUpdatedAt: number | null = null;
      let cursorId: string | null = null;

      for (let currentPage = 1; currentPage <= page; currentPage += 1) {
        const statement =
          cursorUpdatedAt === null || cursorId === null
            ? db.prepare(
                `SELECT p.id, p.slug, p.updated_at
                 FROM posts p
                 WHERE ${POST_PUBLIC_PREDICATE}
                 ORDER BY p.updated_at DESC, p.id DESC
                 LIMIT ?`,
              )
            : db.prepare(
                `SELECT p.id, p.slug, p.updated_at
                 FROM posts p
                 WHERE ${POST_PUBLIC_PREDICATE}
                   AND (p.updated_at < ? OR (p.updated_at = ? AND p.id < ?))
                 ORDER BY p.updated_at DESC, p.id DESC
                 LIMIT ?`,
              );
        const result =
          cursorUpdatedAt === null || cursorId === null
            ? await statement.bind(SITEMAP_PAGE_SIZE).all<PostSitemapRow>()
            : await statement
                .bind(cursorUpdatedAt, cursorUpdatedAt, cursorId, SITEMAP_PAGE_SIZE)
                .all<PostSitemapRow>();
        const rows = result.results;
        if (currentPage === page) {
          return rows.map((post) => ({
            loc: canonicalPostUrl(post.id, post.slug),
            lastmod: post.updated_at,
          }));
        }
        if (rows.length < SITEMAP_PAGE_SIZE) return [];
        const boundary = rows.at(-1)!;
        cursorUpdatedAt = boundary.updated_at;
        cursorId = boundary.id;
      }
      return [];
    },

    async countProfiles() {
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM user_profiles up
           JOIN users u ON u.id = up.user_id
           WHERE ${PROFILE_PUBLIC_PREDICATE}`,
        )
        .first<CountRow>();
      return Number(row?.count ?? 0);
    },

    async listProfilePage(page) {
      if (!validPage(page)) return [];
      let cursorUpdatedAt: number | null = null;
      let cursorUsername: string | null = null;

      for (let currentPage = 1; currentPage <= page; currentPage += 1) {
        const statement =
          cursorUpdatedAt === null || cursorUsername === null
            ? db.prepare(
                `SELECT u.username, up.updated_at
                 FROM user_profiles up
                 JOIN users u ON u.id = up.user_id
                 WHERE ${PROFILE_PUBLIC_PREDICATE}
                 ORDER BY up.updated_at DESC, u.username ASC
                 LIMIT ?`,
              )
            : db.prepare(
                `SELECT u.username, up.updated_at
                 FROM user_profiles up
                 JOIN users u ON u.id = up.user_id
                 WHERE ${PROFILE_PUBLIC_PREDICATE}
                   AND (up.updated_at < ? OR (up.updated_at = ? AND u.username > ?))
                 ORDER BY up.updated_at DESC, u.username ASC
                 LIMIT ?`,
              );
        const result =
          cursorUpdatedAt === null || cursorUsername === null
            ? await statement.bind(SITEMAP_PAGE_SIZE).all<ProfileSitemapRow>()
            : await statement
                .bind(cursorUpdatedAt, cursorUpdatedAt, cursorUsername, SITEMAP_PAGE_SIZE)
                .all<ProfileSitemapRow>();
        const rows = result.results;
        if (currentPage === page) {
          return rows.map((profile) => ({
            loc: canonicalProfileUrl(profile.username),
            lastmod: profile.updated_at,
          }));
        }
        if (rows.length < SITEMAP_PAGE_SIZE) return [];
        const boundary = rows.at(-1)!;
        cursorUpdatedAt = boundary.updated_at;
        cursorUsername = boundary.username;
      }
      return [];
    },
  };
}
