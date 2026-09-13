export const SUPPORTED_LOCALES = ["en", "es", "pt", "fr", "ru", "de"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
  ru: "Русский",
  de: "Deutsch",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value.toLowerCase() as Locale);
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const primary = value.trim().toLowerCase().split("-")[0];
  return isLocale(primary) ? primary : null;
}
