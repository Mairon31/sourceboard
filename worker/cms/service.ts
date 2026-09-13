import { isLocale, type Locale } from "../../shared/i18n/locales";
import { normalizeCmsMarkdown } from "./markdown";
import { normalizeCmsSlug } from "./slugs";
import type {
  CmsAdminPage,
  CmsLocaleStatus,
  CmsNamespace,
  CmsPublicResolution,
  CmsPublishedVariant,
  CmsRevision,
  CmsRevisionInput,
} from "./types";

function assertNamespace(value: string): asserts value is CmsNamespace {
  if (value !== "DOCS" && value !== "LEGAL" && value !== "PAGE") {
    throw new Error("CMS_NAMESPACE_INVALID");
  }
}

function cleanText(value: string, max: number, code: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean || clean.length > max) throw new Error(code);
  return clean;
}

function revisionFromRow(row: {
  id: string;
  pageId: string;
  locale: string;
  version: number;
  slug: string;
  title: string;
  description: string;
  bodyMarkdown: string;
  createdByUserId: string | null;
  createdAt: number;
}): CmsRevision {
  if (!isLocale(row.locale)) throw new Error("CMS_LOCALE_INVALID");
  return { ...row, locale: row.locale };
}

function routeFor(namespace: CmsNamespace, locale: Locale, slug: string): string {
  const section = namespace === "DOCS" ? "docs" : namespace === "LEGAL" ? "legal" : "pages";
  return `/${locale}/${section}/${encodeURIComponent(slug)}`;
}

function normalizedInput(input: CmsRevisionInput): CmsRevisionInput {
  if (!isLocale(input.locale)) throw new Error("CMS_LOCALE_INVALID");
  return {
    locale: input.locale,
    slug: normalizeCmsSlug(input.slug),
    title: cleanText(input.title, 160, "CMS_TITLE_INVALID"),
    description: cleanText(input.description, 320, "CMS_DESCRIPTION_INVALID"),
    bodyMarkdown: normalizeCmsMarkdown(input.bodyMarkdown),
  };
}

export function createCmsService(db: D1Database) {
  async function createRevision(
    pageId: string,
    actorUserId: string,
    input: CmsRevisionInput,
  ): Promise<CmsRevision> {
    const normalized = normalizedInput(input);
    const page = await db
      .prepare("SELECT id FROM cms_pages WHERE id = ?")
      .bind(pageId)
      .first<{ id: string }>();
    if (!page) throw new Error("CMS_PAGE_NOT_FOUND");
    const latest = await db
      .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM cms_page_revisions WHERE page_id = ? AND locale = ?")
      .bind(pageId, normalized.locale)
      .first<{ version: number }>();
    const version = Number(latest?.version ?? 0) + 1;
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.batch([
      db.prepare(
        "INSERT INTO cms_page_revisions (id,page_id,locale,version,slug,title,description,body_markdown,created_by_user_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      ).bind(
        id,
        pageId,
        normalized.locale,
        version,
        normalized.slug,
        normalized.title,
        normalized.description,
        normalized.bodyMarkdown,
        actorUserId,
        now,
      ),
      db.prepare(
        "INSERT INTO cms_page_locale_state (page_id,locale,status,published_revision_id,published_at,published_by_user_id,updated_at) VALUES (?,?,'DRAFT',NULL,NULL,NULL,?) ON CONFLICT(page_id,locale) DO UPDATE SET updated_at = excluded.updated_at",
      ).bind(pageId, normalized.locale, now),
      db.prepare("UPDATE cms_pages SET updated_at = ? WHERE id = ?").bind(now, pageId),
    ]);
    return {
      id,
      pageId,
      version,
      createdByUserId: actorUserId,
      createdAt: now,
      ...normalized,
    };
  }

  async function createPage(
    namespace: CmsNamespace,
    actorUserId: string,
    input: CmsRevisionInput,
  ): Promise<CmsAdminPage> {
    assertNamespace(namespace);
    const pageId = crypto.randomUUID();
    const now = Date.now();
    await db
      .prepare("INSERT INTO cms_pages (id,namespace,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?)")
      .bind(pageId, namespace, actorUserId, now, now)
      .run();
    await createRevision(pageId, actorUserId, input);
    return getAdminPage(pageId);
  }

  async function publishedVariants(pageId: string): Promise<CmsPublishedVariant[]> {
    const rows = await db
      .prepare(
        `SELECT s.locale AS locale, r.slug AS slug, r.title AS title, r.description AS description,
                r.id AS revisionId, s.published_at AS publishedAt
         FROM cms_page_locale_state s
         JOIN cms_page_revisions r ON r.id = s.published_revision_id
         WHERE s.page_id = ? AND s.status = 'PUBLISHED'
         ORDER BY s.locale`,
      )
      .bind(pageId)
      .all<{
        locale: string;
        slug: string;
        title: string;
        description: string;
        revisionId: string;
        publishedAt: number | null;
      }>();
    return rows.results.flatMap((row) =>
      isLocale(row.locale) ? [{ ...row, locale: row.locale }] : [],
    );
  }

  async function publish(
    pageId: string,
    locale: Locale,
    revisionId: string,
    actorUserId: string,
  ): Promise<CmsPublicResolution> {
    const row = await db
      .prepare(
        `SELECT p.namespace AS namespace, r.id AS id, r.page_id AS pageId, r.locale AS locale,
                r.version AS version, r.slug AS slug, r.title AS title, r.description AS description,
                r.body_markdown AS bodyMarkdown, r.created_by_user_id AS createdByUserId,
                r.created_at AS createdAt
         FROM cms_page_revisions r JOIN cms_pages p ON p.id = r.page_id
         WHERE r.id = ? AND r.page_id = ? AND r.locale = ?`,
      )
      .bind(revisionId, pageId, locale)
      .first<{
        namespace: string;
        id: string;
        pageId: string;
        locale: string;
        version: number;
        slug: string;
        title: string;
        description: string;
        bodyMarkdown: string;
        createdByUserId: string | null;
        createdAt: number;
      }>();
    if (!row) throw new Error("CMS_REVISION_NOT_FOUND");
    assertNamespace(row.namespace);
    const collision = await db
      .prepare("SELECT page_id AS pageId FROM cms_page_routes WHERE namespace = ? AND locale = ? AND slug = ?")
      .bind(row.namespace, locale, row.slug)
      .first<{ pageId: string }>();
    if (collision && collision.pageId !== pageId) throw new Error("CMS_SLUG_CONFLICT");
    const now = Date.now();
    await db.batch([
      db.prepare("UPDATE cms_page_routes SET is_current = 0 WHERE page_id = ? AND locale = ? AND is_current = 1").bind(pageId, locale),
      db.prepare(
        `INSERT INTO cms_page_routes (id,page_id,locale,namespace,slug,is_current,created_at)
         VALUES (?,?,?,?,?,1,?)
         ON CONFLICT(namespace,locale,slug) DO UPDATE SET is_current = 1`,
      ).bind(crypto.randomUUID(), pageId, locale, row.namespace, row.slug, now),
      db.prepare(
        `INSERT INTO cms_page_locale_state (page_id,locale,status,published_revision_id,published_at,published_by_user_id,updated_at)
         VALUES (?,?,'PUBLISHED',?,?,?,?)
         ON CONFLICT(page_id,locale) DO UPDATE SET status='PUBLISHED', published_revision_id=excluded.published_revision_id,
           published_at=excluded.published_at, published_by_user_id=excluded.published_by_user_id, updated_at=excluded.updated_at`,
      ).bind(pageId, locale, revisionId, now, actorUserId, now),
      db.prepare(
        "INSERT INTO audit_logs (id,actor_user_id,action,target_type,target_id,created_at) VALUES (?,?, 'cms.publish','CMS_PAGE',?,?)",
      ).bind(crypto.randomUUID(), actorUserId, pageId, now),
    ]);
    return {
      pageId,
      namespace: row.namespace,
      requestedLocale: locale,
      contentLocale: locale,
      isFallback: false,
      revision: revisionFromRow(row),
      canonicalRoute: routeFor(row.namespace, locale, row.slug),
      actualPublishedVariants: await publishedVariants(pageId),
    };
  }

  async function setStatus(
    pageId: string,
    locale: Locale,
    status: Extract<CmsLocaleStatus, "UNPUBLISHED" | "ARCHIVED">,
    actorUserId: string,
  ): Promise<void> {
    const now = Date.now();
    await db.batch([
      db.prepare(
        "UPDATE cms_page_locale_state SET status = ?, published_revision_id = NULL, published_at = NULL, published_by_user_id = ?, updated_at = ? WHERE page_id = ? AND locale = ?",
      ).bind(status, actorUserId, now, pageId, locale),
      db.prepare("UPDATE cms_page_routes SET is_current = 0 WHERE page_id = ? AND locale = ?").bind(pageId, locale),
      db.prepare(
        "INSERT INTO audit_logs (id,actor_user_id,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,'CMS_PAGE',?,?,?)",
      ).bind(crypto.randomUUID(), actorUserId, status === "ARCHIVED" ? "cms.archive" : "cms.unpublish", pageId, JSON.stringify({ locale }), now),
    ]);
  }

  async function resolveForLocale(
    namespace: CmsNamespace,
    locale: Locale,
    slug: string,
  ): Promise<CmsPublicResolution | null> {
    const route = await db
      .prepare(
        `SELECT rt.page_id AS pageId, rt.is_current AS isCurrent, p.namespace AS namespace,
                current.slug AS currentSlug, s.published_revision_id AS publishedRevisionId,
                r.id AS id, r.page_id AS revisionPageId, r.locale AS locale, r.version AS version,
                r.slug AS slug, r.title AS title, r.description AS description, r.body_markdown AS bodyMarkdown,
                r.created_by_user_id AS createdByUserId, r.created_at AS createdAt
         FROM cms_page_routes rt
         JOIN cms_pages p ON p.id = rt.page_id
         JOIN cms_page_locale_state s ON s.page_id = rt.page_id AND s.locale = rt.locale AND s.status = 'PUBLISHED'
         JOIN cms_page_revisions r ON r.id = s.published_revision_id
         LEFT JOIN cms_page_routes current ON current.page_id = rt.page_id AND current.locale = rt.locale AND current.is_current = 1
         WHERE rt.namespace = ? AND rt.locale = ? AND rt.slug = ?`,
      )
      .bind(namespace, locale, normalizeCmsSlug(slug))
      .first<{
        pageId: string;
        isCurrent: number;
        namespace: string;
        currentSlug: string | null;
        publishedRevisionId: string;
        id: string;
        revisionPageId: string;
        locale: string;
        version: number;
        slug: string;
        title: string;
        description: string;
        bodyMarkdown: string;
        createdByUserId: string | null;
        createdAt: number;
      }>();
    if (!route) return null;
    assertNamespace(route.namespace);
    const revision = revisionFromRow({ ...route, pageId: route.revisionPageId });
    return {
      pageId: route.pageId,
      namespace: route.namespace,
      requestedLocale: locale,
      contentLocale: locale,
      isFallback: false,
      revision,
      canonicalRoute: routeFor(route.namespace, locale, route.currentSlug ?? revision.slug),
      actualPublishedVariants: await publishedVariants(route.pageId),
      ...(route.isCurrent ? {} : { redirectTo: routeFor(route.namespace, locale, route.currentSlug ?? revision.slug) }),
    };
  }

  async function resolvePublic(
    namespace: CmsNamespace,
    locale: Locale,
    slug: string,
  ): Promise<CmsPublicResolution | null> {
    assertNamespace(namespace);
    const direct = await resolveForLocale(namespace, locale, slug);
    if (direct) return direct;
    if (locale === "en") return null;
    const fallback = await resolveForLocale(namespace, "en", slug);
    if (!fallback) return null;
    return {
      ...fallback,
      requestedLocale: locale,
      contentLocale: "en",
      isFallback: true,
    };
  }

  async function getAdminPage(pageId: string): Promise<CmsAdminPage> {
    const page = await db
      .prepare("SELECT id, namespace, created_by_user_id AS createdByUserId, created_at AS createdAt, updated_at AS updatedAt FROM cms_pages WHERE id = ?")
      .bind(pageId)
      .first<{
        id: string;
        namespace: string;
        createdByUserId: string | null;
        createdAt: number;
        updatedAt: number;
      }>();
    if (!page) throw new Error("CMS_PAGE_NOT_FOUND");
    assertNamespace(page.namespace);
    const states = await db
      .prepare(
        `SELECT l.locale AS locale, COALESCE(s.status,'DRAFT') AS status,
                s.published_revision_id AS publishedRevisionId, s.published_at AS publishedAt,
                latest.id AS id, latest.page_id AS pageId, latest.version AS version, latest.slug AS slug,
                latest.title AS title, latest.description AS description, latest.body_markdown AS bodyMarkdown,
                latest.created_by_user_id AS createdByUserId, latest.created_at AS createdAt
         FROM (SELECT 'en' locale UNION ALL SELECT 'es' UNION ALL SELECT 'pt' UNION ALL SELECT 'fr' UNION ALL SELECT 'ru' UNION ALL SELECT 'de') l
         LEFT JOIN cms_page_locale_state s ON s.page_id = ? AND s.locale = l.locale
         LEFT JOIN cms_page_revisions latest ON latest.id = (
           SELECT id FROM cms_page_revisions WHERE page_id = ? AND locale = l.locale ORDER BY version DESC LIMIT 1
         )`,
      )
      .bind(pageId, pageId)
      .all<{
        locale: string;
        status: CmsLocaleStatus;
        publishedRevisionId: string | null;
        publishedAt: number | null;
        id: string | null;
        pageId: string | null;
        version: number | null;
        slug: string | null;
        title: string | null;
        description: string | null;
        bodyMarkdown: string | null;
        createdByUserId: string | null;
        createdAt: number | null;
      }>();
    return {
      ...page,
      namespace: page.namespace,
      locales: states.results.flatMap((state) => {
        if (!isLocale(state.locale)) return [];
        const latestRevision = state.id && state.pageId && state.version && state.slug && state.title && state.description !== null && state.bodyMarkdown !== null && state.createdAt !== null
          ? revisionFromRow({
              id: state.id,
              pageId: state.pageId,
              locale: state.locale,
              version: state.version,
              slug: state.slug,
              title: state.title,
              description: state.description,
              bodyMarkdown: state.bodyMarkdown,
              createdByUserId: state.createdByUserId,
              createdAt: state.createdAt,
            })
          : null;
        return [{
          locale: state.locale,
          status: state.status,
          publishedRevisionId: state.publishedRevisionId,
          publishedAt: state.publishedAt,
          latestRevision,
          hasDraftChanges: Boolean(latestRevision && state.publishedRevisionId && latestRevision.id !== state.publishedRevisionId),
        }];
      }),
    };
  }

  return {
    createPage,
    createRevision,
    publish,
    unpublish: (pageId: string, locale: Locale, actorUserId: string) => setStatus(pageId, locale, "UNPUBLISHED", actorUserId),
    archive: (pageId: string, locale: Locale, actorUserId: string) => setStatus(pageId, locale, "ARCHIVED", actorUserId),
    resolvePublic,
    getAdminPage,
    publishedVariants,
  };
}
