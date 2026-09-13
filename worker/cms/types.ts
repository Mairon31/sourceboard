import type { Locale } from "../../shared/i18n/locales";

export type CmsNamespace = "DOCS" | "LEGAL" | "PAGE";
export type CmsLocaleStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
export type CmsNavigationSurface = "DOCS" | "FOOTER";

export interface CmsRevisionInput {
  locale: Locale;
  slug: string;
  title: string;
  description: string;
  bodyMarkdown: string;
}

export interface CmsRevision extends CmsRevisionInput {
  id: string;
  pageId: string;
  version: number;
  createdByUserId: string | null;
  createdAt: number;
}

export interface CmsPublishedVariant {
  locale: Locale;
  slug: string;
  title: string;
  description: string;
  revisionId: string;
  publishedAt: number | null;
}

export interface CmsPublicResolution {
  pageId: string;
  namespace: CmsNamespace;
  requestedLocale: Locale;
  contentLocale: Locale;
  isFallback: boolean;
  revision: CmsRevision;
  canonicalRoute: string;
  actualPublishedVariants: CmsPublishedVariant[];
  redirectTo?: string;
}

export interface CmsAdminLocaleState {
  locale: Locale;
  status: CmsLocaleStatus;
  publishedRevisionId: string | null;
  publishedAt: number | null;
  latestRevision: CmsRevision | null;
  hasDraftChanges: boolean;
}

export interface CmsAdminPage {
  id: string;
  namespace: CmsNamespace;
  createdByUserId: string | null;
  createdAt: number;
  updatedAt: number;
  locales: CmsAdminLocaleState[];
}

export interface CmsNavigationItem {
  id: string;
  pageId: string;
  surface: CmsNavigationSurface;
  groupKey: string;
  sortOrder: number;
  isVisible: boolean;
  label: string;
  href: string | null;
}
