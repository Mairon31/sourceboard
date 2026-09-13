import type { Locale } from "../../../shared/i18n/locales";

const enCommonMessages = {
  "share.action": "Share",
  "share.copied": "Copied",
  "share.unavailable": "Unable to share.",
} as const;

export type CommonMessageKey = keyof typeof enCommonMessages;
type CommonMessages = Record<CommonMessageKey, string>;

export const commonMessageSets: Record<Locale, CommonMessages> = {
  en: enCommonMessages,
  es: {
    "share.action": "Compartir",
    "share.copied": "Copiado",
    "share.unavailable": "No se pudo compartir.",
  },
  pt: {
    "share.action": "Compartilhar",
    "share.copied": "Copiado",
    "share.unavailable": "Não foi possível compartilhar.",
  },
  fr: {
    "share.action": "Partager",
    "share.copied": "Copié",
    "share.unavailable": "Impossible de partager.",
  },
  ru: {
    "share.action": "Поделиться",
    "share.copied": "Скопировано",
    "share.unavailable": "Не удалось поделиться.",
  },
  de: {
    "share.action": "Teilen",
    "share.copied": "Kopiert",
    "share.unavailable": "Teilen nicht möglich.",
  },
};
