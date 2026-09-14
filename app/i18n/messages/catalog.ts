import type { Locale } from "../../../shared/i18n/locales";
import { deBaseMessages } from "./locales/de/base";
import { deCommonMessages } from "./locales/de/common";
import { deCommunityMessages } from "./locales/de/community";
import { deEditingMessages } from "./locales/de/editing";
import { deProductMessages } from "./locales/de/product";
import { deSettingsMessages } from "./locales/de/settings";
import { deSocialMessages } from "./locales/de/social";
import { deStoreMessages } from "./locales/de/store";
import { enBaseMessages } from "./locales/en/base";
import { enCommonMessages } from "./locales/en/common";
import { enCommunityMessages } from "./locales/en/community";
import { enEditingMessages } from "./locales/en/editing";
import { enProductMessages } from "./locales/en/product";
import { enSettingsMessages } from "./locales/en/settings";
import { enSocialMessages } from "./locales/en/social";
import { enStoreMessages } from "./locales/en/store";
import { esBaseMessages } from "./locales/es/base";
import { esCommonMessages } from "./locales/es/common";
import { esCommunityMessages } from "./locales/es/community";
import { esEditingMessages } from "./locales/es/editing";
import { esProductMessages } from "./locales/es/product";
import { esSettingsMessages } from "./locales/es/settings";
import { esSocialMessages } from "./locales/es/social";
import { esStoreMessages } from "./locales/es/store";
import { frBaseMessages } from "./locales/fr/base";
import { frCommonMessages } from "./locales/fr/common";
import { frCommunityMessages } from "./locales/fr/community";
import { frEditingMessages } from "./locales/fr/editing";
import { frProductMessages } from "./locales/fr/product";
import { frSettingsMessages } from "./locales/fr/settings";
import { frSocialMessages } from "./locales/fr/social";
import { frStoreMessages } from "./locales/fr/store";
import { ptBaseMessages } from "./locales/pt/base";
import { ptCommonMessages } from "./locales/pt/common";
import { ptCommunityMessages } from "./locales/pt/community";
import { ptEditingMessages } from "./locales/pt/editing";
import { ptProductMessages } from "./locales/pt/product";
import { ptSettingsMessages } from "./locales/pt/settings";
import { ptSocialMessages } from "./locales/pt/social";
import { ptStoreMessages } from "./locales/pt/store";
import { ruBaseMessages } from "./locales/ru/base";
import { ruCommonMessages } from "./locales/ru/common";
import { ruCommunityMessages } from "./locales/ru/community";
import { ruEditingMessages } from "./locales/ru/editing";
import { ruProductMessages } from "./locales/ru/product";
import { ruSettingsMessages } from "./locales/ru/settings";
import { ruSocialMessages } from "./locales/ru/social";
import { ruStoreMessages } from "./locales/ru/store";
import type { MessageCatalog, MessageKey, MessageNamespaces } from "./types";

export type { MessageKey } from "./types";

export const messageNamespaces = {
  en: {
    base: enBaseMessages,
    common: enCommonMessages,
    community: enCommunityMessages,
    editing: enEditingMessages,
    product: enProductMessages,
    settings: enSettingsMessages,
    social: enSocialMessages,
    store: enStoreMessages,
  },
  es: {
    base: esBaseMessages,
    common: esCommonMessages,
    community: esCommunityMessages,
    editing: esEditingMessages,
    product: esProductMessages,
    settings: esSettingsMessages,
    social: esSocialMessages,
    store: esStoreMessages,
  },
  pt: {
    base: ptBaseMessages,
    common: ptCommonMessages,
    community: ptCommunityMessages,
    editing: ptEditingMessages,
    product: ptProductMessages,
    settings: ptSettingsMessages,
    social: ptSocialMessages,
    store: ptStoreMessages,
  },
  fr: {
    base: frBaseMessages,
    common: frCommonMessages,
    community: frCommunityMessages,
    editing: frEditingMessages,
    product: frProductMessages,
    settings: frSettingsMessages,
    social: frSocialMessages,
    store: frStoreMessages,
  },
  ru: {
    base: ruBaseMessages,
    common: ruCommonMessages,
    community: ruCommunityMessages,
    editing: ruEditingMessages,
    product: ruProductMessages,
    settings: ruSettingsMessages,
    social: ruSocialMessages,
    store: ruStoreMessages,
  },
  de: {
    base: deBaseMessages,
    common: deCommonMessages,
    community: deCommunityMessages,
    editing: deEditingMessages,
    product: deProductMessages,
    settings: deSettingsMessages,
    social: deSocialMessages,
    store: deStoreMessages,
  },
} satisfies Record<Locale, MessageNamespaces>;

export const allMessages = Object.fromEntries(
  (Object.keys(messageNamespaces) as Locale[]).map((locale) => [
    locale,
    Object.assign({}, ...Object.values(messageNamespaces[locale])),
  ]),
) as Record<Locale, MessageCatalog>;

export function isMessageKey(value: string): value is MessageKey {
  return Object.prototype.hasOwnProperty.call(allMessages.en, value);
}
