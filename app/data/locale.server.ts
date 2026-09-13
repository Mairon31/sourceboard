import {
  DEFAULT_LOCALE,
  isLocale,
  normalizeLocale,
  type Locale,
} from "../../shared/i18n/locales";

export const LOCALE_COOKIE_NAME = "sourceboard_locale";
export const LOCALE_COOKIE_MAX_AGE = 31_536_000;

export interface LocaleResolutionInput {
  explicitLang?: string | null;
  cookieLocale?: string | null;
  accountLocale?: string | null;
  acceptLanguage?: string | null;
  shortLinkDefaultEnglish?: boolean;
}

interface LanguagePreference {
  locale: Locale;
  quality: number;
  position: number;
}

export function parseAcceptLanguage(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const preferences: LanguagePreference[] = [];
  for (const [position, rawPart] of value.split(",").slice(0, 24).entries()) {
    const [rawTag, ...params] = rawPart.trim().split(";");
    const locale = normalizeLocale(rawTag);
    if (!locale) continue;
    let quality = 1;
    for (const parameter of params) {
      const match = /^q=(0(?:\.\d{1,3})?|1(?:\.0{1,3})?)$/i.exec(parameter.trim());
      if (match) quality = Number(match[1]);
    }
    if (quality > 0) preferences.push({ locale, quality, position });
  }
  preferences.sort((a, b) => b.quality - a.quality || a.position - b.position);
  return preferences[0]?.locale ?? null;
}

export function readLocaleCookie(cookieHeader: string | null | undefined): Locale | null {
  if (!cookieHeader) return null;
  for (const segment of cookieHeader.split(";")) {
    const [name, ...valueParts] = segment.trim().split("=");
    if (name !== LOCALE_COOKIE_NAME) continue;
    const raw = decodeURIComponent(valueParts.join("="));
    return isLocale(raw) ? raw : null;
  }
  return null;
}

export function localeCookie(locale: Locale, secure = true): string {
  return `${LOCALE_COOKIE_NAME}=${locale}; Path=/; SameSite=Lax; Max-Age=${LOCALE_COOKIE_MAX_AGE}${secure ? "; Secure" : ""}`;
}

export function resolveLocale(input: LocaleResolutionInput): Locale {
  if (isLocale(input.explicitLang)) return input.explicitLang;
  if (input.shortLinkDefaultEnglish) return DEFAULT_LOCALE;
  if (isLocale(input.cookieLocale)) return input.cookieLocale;
  if (isLocale(input.accountLocale)) return input.accountLocale;
  return parseAcceptLanguage(input.acceptLanguage) ?? DEFAULT_LOCALE;
}

export function requestedLocale(request: Request, accountLocale?: string | null): Locale {
  const url = new URL(request.url);
  return resolveLocale({
    explicitLang: url.searchParams.get("lang"),
    cookieLocale: readLocaleCookie(request.headers.get("cookie")),
    accountLocale,
    acceptLanguage: request.headers.get("accept-language"),
    shortLinkDefaultEnglish: url.pathname.startsWith("/sh/") && !url.searchParams.has("lang"),
  });
}
