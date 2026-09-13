import type { Locale } from "../../../shared/i18n/locales";

const enCommonMessages = {
  "share.action": "Share",
  "share.copied": "Copied",
  "share.unavailable": "Unable to share.",
  "search.filter.open": "Open",
  "metrics.likes.one": "{count} like",
  "metrics.likes.other": "{count} likes",
  "post.engagementAria": "Post engagement",
} as const;

export type CommonMessageKey = keyof typeof enCommonMessages;
type CommonMessages = Record<CommonMessageKey, string>;

export const commonMessageSets: Record<Locale, CommonMessages> = {
  en: enCommonMessages,
  es: {
    "share.action": "Compartir",
    "share.copied": "Copiado",
    "share.unavailable": "No se pudo compartir.",
    "search.filter.open": "Abiertas",
    "metrics.likes.one": "{count} Me gusta",
    "metrics.likes.other": "{count} Me gusta",
    "post.engagementAria": "Interacción con la publicación",
  },
  pt: {
    "share.action": "Compartilhar",
    "share.copied": "Copiado",
    "share.unavailable": "Não foi possível compartilhar.",
    "search.filter.open": "Abertas",
    "metrics.likes.one": "{count} curtida",
    "metrics.likes.other": "{count} curtidas",
    "post.engagementAria": "Engajamento da publicação",
  },
  fr: {
    "share.action": "Partager",
    "share.copied": "Copié",
    "share.unavailable": "Impossible de partager.",
    "search.filter.open": "Ouvertes",
    "metrics.likes.one": "{count} J’aime",
    "metrics.likes.other": "{count} J’aime",
    "post.engagementAria": "Engagement de la publication",
  },
  ru: {
    "share.action": "Поделиться",
    "share.copied": "Скопировано",
    "share.unavailable": "Не удалось поделиться.",
    "search.filter.open": "Открытые",
    "metrics.likes.one": "{count} отметка",
    "metrics.likes.other": "{count} отметок",
    "post.engagementAria": "Вовлечённость публикации",
  },
  de: {
    "share.action": "Teilen",
    "share.copied": "Kopiert",
    "share.unavailable": "Teilen nicht möglich.",
    "search.filter.open": "Offen",
    "metrics.likes.one": "{count} Like",
    "metrics.likes.other": "{count} Likes",
    "post.engagementAria": "Beitragsinteraktionen",
  },
};