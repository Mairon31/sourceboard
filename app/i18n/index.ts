import type { Locale } from "../../shared/i18n/locales";
import { deMessages } from "./messages/de";
import { enMessages, type MessageKey as BaseMessageKey } from "./messages/en";
import { esMessages } from "./messages/es";
import { frMessages } from "./messages/fr";
import { ptMessages } from "./messages/pt";
import { ruMessages } from "./messages/ru";
import { deStoreMessages } from "./messages/store.de";
import { enStoreMessages, type StoreMessageKey } from "./messages/store.en";
import { esStoreMessages } from "./messages/store.es";
import { frStoreMessages } from "./messages/store.fr";
import { ptStoreMessages } from "./messages/store.pt";
import { ruStoreMessages } from "./messages/store.ru";

export type MessageKey = BaseMessageKey | StoreMessageKey;

const baseMessages: Record<Locale, Record<BaseMessageKey, string>> = {
  en: enMessages,
  es: esMessages,
  pt: ptMessages,
  fr: frMessages,
  ru: ruMessages,
  de: deMessages,
};

const storeMessages: Record<Locale, Record<StoreMessageKey, string>> = {
  en: enStoreMessages,
  es: esStoreMessages,
  pt: ptStoreMessages,
  fr: frStoreMessages,
  ru: ruStoreMessages,
  de: deStoreMessages,
};

const englishMessages: Record<MessageKey, string> = { ...enMessages, ...enStoreMessages };

export const allMessages = Object.fromEntries(
  (Object.keys(baseMessages) as Locale[]).map((locale) => [
    locale,
    { ...baseMessages[locale], ...storeMessages[locale] },
  ]),
) as Record<Locale, Record<MessageKey, string>>;

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  return interpolate(allMessages[locale][key] ?? englishMessages[key], vars);
}

export function translatePlural(
  locale: Locale,
  baseKey: string,
  count: number,
  vars?: Record<string, string | number>,
): string {
  const category = new Intl.PluralRules(locale).select(count);
  const localeMessages = allMessages[locale] as Record<string, string>;
  const preferred = `${baseKey}.${category}`;
  const fallback = `${baseKey}.other`;
  const key = (localeMessages[preferred] ? preferred : fallback) as MessageKey;
  return translate(locale, key, { count, ...vars });
}

export function formatDateTime(
  locale: Locale,
  value: Date | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(value instanceof Date ? value : new Date(value));
}

export function formatRelativeTime(locale: Locale, deltaSeconds: number): string {
  const abs = Math.abs(deltaSeconds);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60) return formatter.format(Math.round(deltaSeconds), "second");
  if (abs < 3600) return formatter.format(Math.round(deltaSeconds / 60), "minute");
  if (abs < 86400) return formatter.format(Math.round(deltaSeconds / 3600), "hour");
  return formatter.format(Math.round(deltaSeconds / 86400), "day");
}
