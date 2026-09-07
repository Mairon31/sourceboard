import type { StoreItemType } from "../../../../shared/ui/contracts";

export type StoreLifecycleState = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type EmoteModerationState = "CLEAR" | "FLAGGED" | "HIDDEN" | "REMOVED";

export interface AdminStoreItem {
  id: string;
  type: StoreItemType;
  name: string;
  description: string;
  pricePoints: number;
  assetId: string | null;
  configJson: string;
  lifecycleState: StoreLifecycleState;
  isEnabled: boolean | number;
  isFeatured: boolean | number;
  startsAt: number | null;
  endsAt: number | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  ownerCount: number;
  equippedCount: number;
}

export interface AdminEmote {
  id: string;
  shortcode: string;
  label: string;
  assetKey: string;
  packId: string | null;
  sortOrder: number;
  status: "ACTIVE" | "DISABLED";
  lifecycleState: StoreLifecycleState;
  isEnabled: boolean | number;
  moderationState: EmoteModerationState;
  createdAt: number;
  updatedAt: number | null;
}

export interface EmotePackSummary {
  id: string;
  slug: string;
  label: string;
  status: "ACTIVE" | "DISABLED";
  lifecycleState: StoreLifecycleState;
  isEnabled: boolean | number;
  createdAt: number;
  updatedAt: number | null;
  storeItemId: string | null;
  description: string | null;
  pricePoints: number | null;
  storeLifecycleState: StoreLifecycleState | null;
  storeEnabled: boolean | number | null;
  isFeatured: boolean | number | null;
  emoteCount: number;
}

export interface EmotePackDetail extends EmotePackSummary {
  storeName?: string | null;
  storeSortOrder?: number | null;
  emotes: AdminEmote[];
}
