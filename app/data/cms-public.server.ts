import type { Locale } from "../../shared/i18n/locales";
import { readSourceBoardRequestContext } from "../../shared/router-context";
import { createCmsNavigationService } from "../../worker/cms/navigation";
import { createCmsService } from "../../worker/cms/service";
import type {
  CmsNamespace,
  CmsNavigationItem,
  CmsNavigationSurface,
  CmsPublicResolution,
} from "../../worker/cms/types";
import { requestedLocale } from "./locale.server";
import type { ServerLoaderArgs } from "./server-request";

export interface PublicCmsRuntime {
  locale: Locale;
  available: boolean;
}

function database(context: ServerLoaderArgs["context"]): D1Database | null {
  return readSourceBoardRequestContext(context)?.env.DB ?? null;
}

export function publicCmsRuntime(request: Request, context: ServerLoaderArgs["context"]): PublicCmsRuntime {
  return { locale: requestedLocale(request), available: Boolean(database(context)) };
}

export async function resolvePublicCmsPage(
  request: Request,
  context: ServerLoaderArgs["context"],
  namespace: CmsNamespace,
  slug: string,
): Promise<{ locale: Locale; resolution: CmsPublicResolution | null }> {
  const locale = requestedLocale(request);
  const db = database(context);
  if (!db) return { locale, resolution: null };
  try {
    return { locale, resolution: await createCmsService(db).resolvePublic(namespace, locale, slug) };
  } catch {
    // Rolling deploy compatibility: the static source remains authoritative until
    // the CMS migration/seed exists in the target environment.
    return { locale, resolution: null };
  }
}

export async function listPublicCmsNavigation(
  request: Request,
  context: ServerLoaderArgs["context"],
  surface: CmsNavigationSurface,
): Promise<{ locale: Locale; items: CmsNavigationItem[] }> {
  const locale = requestedLocale(request);
  const db = database(context);
  if (!db) return { locale, items: [] };
  try {
    return { locale, items: await createCmsNavigationService(db).list(surface, locale) };
  } catch {
    return { locale, items: [] };
  }
}

export function localizedCmsPath(
  locale: Locale,
  namespace: CmsNamespace,
  slug: string,
): string {
  const section = namespace === "DOCS" ? "docs" : namespace === "LEGAL" ? "legal" : "pages";
  return `/${locale}/${section}/${encodeURIComponent(slug)}`;
}
