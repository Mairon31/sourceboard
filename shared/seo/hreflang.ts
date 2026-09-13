import { isLocale, type Locale } from "../i18n/locales";

export interface HreflangVariant {
  locale: Locale;
  href: string;
}

export interface HreflangLink {
  tagName: "link";
  rel: "alternate";
  hrefLang: string;
  href: string;
}

export function hreflangLinks(
  variants: HreflangVariant[],
  defaultHref?: string,
): HreflangLink[] {
  const deduped = new Map<Locale, string>();
  for (const variant of variants) {
    if (!isLocale(variant.locale) || deduped.has(variant.locale)) continue;
    const url = new URL(variant.href, "https://srcboard.me");
    if (url.origin !== "https://srcboard.me") continue;
    deduped.set(variant.locale, url.toString());
  }
  const links: HreflangLink[] = [...deduped.entries()].map(([locale, href]) => ({
    tagName: "link",
    rel: "alternate",
    hrefLang: locale,
    href,
  }));
  if (defaultHref) {
    const url = new URL(defaultHref, "https://srcboard.me");
    if (url.origin === "https://srcboard.me") {
      links.push({ tagName: "link", rel: "alternate", hrefLang: "x-default", href: url.toString() });
    }
  }
  return links;
}
