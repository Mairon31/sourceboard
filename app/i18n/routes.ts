import { isLocale, type Locale } from "../../shared/i18n/locales";

export type OfficialRouteId = "home" | "store" | "categories" | "docs" | "legal";

const OFFICIAL_PATHS: Record<OfficialRouteId, string> = {
  home: "",
  store: "/store",
  categories: "/category",
  docs: "/docs",
  legal: "/legal",
};

export function localizedHref(locale: Locale, route: OfficialRouteId, suffix = ""): string {
  const base = `/${locale}${OFFICIAL_PATHS[route]}`;
  if (!suffix) return base;
  return `${base}/${suffix.replace(/^\/+/, "")}`;
}

export function withLangQuery(url: string, locale: Locale): string {
  const parsed = new URL(url, "https://srcboard.me");
  parsed.searchParams.set("lang", locale);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function stripLangForCanonical(url: string): string {
  const parsed = new URL(url, "https://srcboard.me");
  parsed.searchParams.delete("lang");
  return parsed.toString();
}

export function switchLocaleHref(pathname: string, search: string, locale: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  const currentLocale = isLocale(segments[0]) ? segments[0] : null;
  const unprefixed = currentLocale ? `/${segments.slice(1).join("/")}` : pathname;
  const official =
    unprefixed === "/" ||
    unprefixed === "" ||
    unprefixed === "/store" ||
    unprefixed === "/category" ||
    unprefixed.startsWith("/category/") ||
    unprefixed === "/docs" ||
    unprefixed.startsWith("/docs/") ||
    unprefixed === "/legal" ||
    unprefixed.startsWith("/legal/");
  if (official) return `/${locale}${unprefixed === "/" ? "" : unprefixed}`;
  return withLangQuery(`${pathname}${search}`, locale);
}
