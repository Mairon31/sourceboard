import { isLocale, type Locale } from "../../shared/i18n/locales";
import type { CmsNavigationItem, CmsNavigationSurface } from "./types";

function assertSurface(value: string): asserts value is CmsNavigationSurface {
  if (value !== "DOCS" && value !== "FOOTER") throw new Error("CMS_NAV_SURFACE_INVALID");
}

export function createCmsNavigationService(db: D1Database) {
  async function list(surface: CmsNavigationSurface, locale: Locale): Promise<CmsNavigationItem[]> {
    assertSurface(surface);
    if (!isLocale(locale)) throw new Error("CMS_LOCALE_INVALID");
    const rows = await db
      .prepare(
        `SELECT n.id, n.page_id AS pageId, n.surface, n.group_key AS groupKey,
                n.sort_order AS sortOrder, n.is_visible AS isVisible,
                COALESCE(lbl.label, local.title, english.title) AS label,
                COALESCE(localRoute.slug, englishRoute.slug) AS slug,
                p.namespace AS namespace,
                CASE WHEN localRoute.slug IS NOT NULL THEN ? ELSE 'en' END AS routeLocale
         FROM cms_navigation_items n
         JOIN cms_pages p ON p.id = n.page_id
         LEFT JOIN cms_navigation_labels lbl ON lbl.navigation_item_id = n.id AND lbl.locale = ?
         LEFT JOIN cms_page_locale_state localState ON localState.page_id = n.page_id AND localState.locale = ? AND localState.status = 'PUBLISHED'
         LEFT JOIN cms_page_revisions local ON local.id = localState.published_revision_id
         LEFT JOIN cms_page_routes localRoute ON localRoute.page_id = n.page_id AND localRoute.locale = ? AND localRoute.is_current = 1
         LEFT JOIN cms_page_locale_state englishState ON englishState.page_id = n.page_id AND englishState.locale = 'en' AND englishState.status = 'PUBLISHED'
         LEFT JOIN cms_page_revisions english ON english.id = englishState.published_revision_id
         LEFT JOIN cms_page_routes englishRoute ON englishRoute.page_id = n.page_id AND englishRoute.locale = 'en' AND englishRoute.is_current = 1
         WHERE n.surface = ? AND n.is_visible = 1
         ORDER BY n.group_key, n.sort_order, n.id`,
      )
      .bind(locale, locale, locale, locale, surface)
      .all<{
        id: string;
        pageId: string;
        surface: string;
        groupKey: string;
        sortOrder: number;
        isVisible: number;
        label: string | null;
        slug: string | null;
        namespace: string;
        routeLocale: string;
      }>();
    return rows.results.map((row) => {
      assertSurface(row.surface);
      const section = row.namespace === "DOCS" ? "docs" : row.namespace === "LEGAL" ? "legal" : "pages";
      return {
        id: row.id,
        pageId: row.pageId,
        surface: row.surface,
        groupKey: row.groupKey,
        sortOrder: row.sortOrder,
        isVisible: Boolean(row.isVisible),
        label: row.label ?? row.slug ?? "Untitled",
        href: row.slug ? `/${row.routeLocale}/${section}/${encodeURIComponent(row.slug)}` : null,
      };
    });
  }

  async function reorder(
    surface: CmsNavigationSurface,
    groupKey: string,
    orderedIds: string[],
  ): Promise<void> {
    assertSurface(surface);
    if (!groupKey.trim() || orderedIds.length > 100 || new Set(orderedIds).size !== orderedIds.length) {
      throw new Error("CMS_NAV_ORDER_INVALID");
    }
    if (!orderedIds.length) return;
    const placeholders = orderedIds.map(() => "?").join(",");
    const rows = await db
      .prepare(`SELECT id FROM cms_navigation_items WHERE surface = ? AND group_key = ? AND id IN (${placeholders})`)
      .bind(surface, groupKey, ...orderedIds)
      .all<{ id: string }>();
    if (rows.results.length !== orderedIds.length) throw new Error("CMS_NAV_SCOPE_INVALID");
    const now = Date.now();
    await db.batch(
      orderedIds.map((id, sortOrder) =>
        db.prepare("UPDATE cms_navigation_items SET sort_order = ?, updated_at = ? WHERE id = ? AND surface = ? AND group_key = ?").bind(sortOrder, now, id, surface, groupKey),
      ),
    );
  }

  return { list, reorder };
}
