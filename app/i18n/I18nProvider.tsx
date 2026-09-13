import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "../../shared/i18n/locales";
import {
  formatDateTime,
  formatRelativeTime,
  translate,
  translatePlural,
  type MessageKey,
} from "./index";

export interface I18nContextValue {
  locale: Locale;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  tp: (baseKey: string, count: number, vars?: Record<string, string | number>) => string;
  date: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  relative: (deltaSeconds: number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, vars) => translate(locale, key, vars),
      tp: (baseKey, count, vars) => translatePlural(locale, baseKey, count, vars),
      date: (input, options) => formatDateTime(locale, input, options),
      relative: (deltaSeconds) => formatRelativeTime(locale, deltaSeconds),
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
