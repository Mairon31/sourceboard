export type ShareResourceType = "POST" | "COMMENT";

export interface ShareLinkRecord {
  shortId: string;
  resourceType: ShareResourceType;
  resourceId: string;
  createdAt: number;
}

export interface ShareLinkStore {
  findByResource(type: ShareResourceType, resourceId: string): Promise<ShareLinkRecord | null>;
  findByShortId(shortId: string): Promise<ShareLinkRecord | null>;
  insert(record: ShareLinkRecord): Promise<boolean>;
}
