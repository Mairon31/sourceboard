import type { Locale } from "../i18n/locales";
import { hreflangLinks } from "./hreflang";
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

export function officialPageMeta({ page, locale }: { page: PublicOfficialPageSeo; locale: Locale }) {
  const selected = page.variants.find((variant) => variant.locale === locale) ?? page.variants.find((variant) => variant.locale === "en") ?? page.variants[0];
  if (!selected) return [{ name: "robots", content: "noindex,nofollow" }];
  const canonical = absoluteSourceBoardUrl(selected.path);
  const alternates = page.variants.map((variant) => ({
    locale: variant.locale,
    href: absoluteSourceBoardUrl(variant.path),
  }));
  return [
    { title: selected.title },
    { name: "description", content: selected.description },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: selected.title },
    { property: "og:description", content: selected.description },
    { property: "og:url", content: canonical },
    ...hreflangLinks(alternates, page.variants.find((variant) => variant.locale === "en") ? absoluteSourceBoardUrl(page.variants.find((variant) => variant.locale === "en")!.path) : canonical),
  ];
}
