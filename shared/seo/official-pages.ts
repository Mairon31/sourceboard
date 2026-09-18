import { SUPPORTED_LOCALES, type Locale } from "../i18n/locales";
import { hreflangLinks } from "./hreflang";
import { INDEXABLE_ROBOTS } from "./robots";
import { absoluteSourceBoardUrl } from "./urls";

export interface PublishedLocaleVariant {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  updatedAt?: number;
}

export interface PublicOfficialPageSeo {
  pageId: string;
  variants: PublishedLocaleVariant[];
}

export interface LocalizedPageSeo {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  indexable?: boolean;
}

function localizedPath(locale: Locale, path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${suffix === "/" ? "" : suffix}`;
}

export function localizedPageMeta({
  locale,
  path,
  title,
  description,
  indexable = true,
}: LocalizedPageSeo) {
  const canonical = absoluteSourceBoardUrl(localizedPath(locale, path));
  const englishPath = absoluteSourceBoardUrl(localizedPath("en", path));
  const image = absoluteSourceBoardUrl("/sourceboard-og.png");
  return [
    { title },
    { name: "description", content: description.slice(0, 180) },
    {
      name: "robots",
      content: indexable ? INDEXABLE_ROBOTS : "noindex, follow",
    },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "SourceBoard" },
    { property: "og:title", content: title },
    { property: "og:description", content: description.slice(0, 180) },
    { property: "og:url", content: canonical },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description.slice(0, 180) },
    { name: "twitter:image", content: image },
    ...hreflangLinks(
      SUPPORTED_LOCALES.map((candidate) => ({
        locale: candidate,
        href: absoluteSourceBoardUrl(localizedPath(candidate, path)),
      })),
      englishPath,
    ),
  ];
}

export function officialPageMeta({
  page,
  locale,
}: {
  page: PublicOfficialPageSeo;
  locale: Locale;
}) {
  const selected =
    page.variants.find((variant) => variant.locale === locale) ??
    page.variants.find((variant) => variant.locale === "en") ??
    page.variants[0];
  if (!selected) return [{ name: "robots", content: "noindex,nofollow" }];
  const canonical = absoluteSourceBoardUrl(selected.path);
  const alternates = page.variants.map((variant) => ({
    locale: variant.locale,
    href: absoluteSourceBoardUrl(variant.path),
  }));
  return [
    { title: selected.title },
    { name: "description", content: selected.description },
    { name: "robots", content: INDEXABLE_ROBOTS },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "SourceBoard" },
    { property: "og:title", content: selected.title },
    { property: "og:description", content: selected.description },
    { property: "og:url", content: canonical },
    { property: "og:image", content: absoluteSourceBoardUrl("/sourceboard-og.png") },
    ...hreflangLinks(
      alternates,
      page.variants.find((variant) => variant.locale === "en")
        ? absoluteSourceBoardUrl(page.variants.find((variant) => variant.locale === "en")!.path)
        : canonical,
    ),
  ];
}
