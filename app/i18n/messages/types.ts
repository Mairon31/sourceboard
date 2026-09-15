import { enAdminMessages } from "./locales/en/admin";
import { enBaseMessages } from "./locales/en/base";
import { enCommonMessages } from "./locales/en/common";
import { enCommunityMessages } from "./locales/en/community";
import { enEditingMessages } from "./locales/en/editing";
import { enProductMessages } from "./locales/en/product";
import { enSettingsMessages } from "./locales/en/settings";
import { enSocialMessages } from "./locales/en/social";
import { enStoreMessages } from "./locales/en/store";

type Localized<T> = { [Key in keyof T]: string };

export type AdminMessages = Localized<typeof enAdminMessages>;
export type BaseMessages = Localized<typeof enBaseMessages>;
export type CommonMessages = Localized<typeof enCommonMessages>;
export type CommunityMessages = Localized<typeof enCommunityMessages>;
export type EditingMessages = Localized<typeof enEditingMessages>;
export type ProductMessages = Localized<typeof enProductMessages>;
export type SettingsMessages = Localized<typeof enSettingsMessages>;
export type SocialMessages = Localized<typeof enSocialMessages>;
export type StoreMessages = Localized<typeof enStoreMessages>;

export interface MessageNamespaces {
  admin: AdminMessages;
  base: BaseMessages;
  common: CommonMessages;
  community: CommunityMessages;
  editing: EditingMessages;
  product: ProductMessages;
  settings: SettingsMessages;
  social: SocialMessages;
  store: StoreMessages;
}

export type MessageCatalog = AdminMessages &
  BaseMessages &
  CommonMessages &
  CommunityMessages &
  EditingMessages &
  ProductMessages &
  SettingsMessages &
  SocialMessages &
  StoreMessages;

export type MessageKey = keyof MessageCatalog;
