import type { PublicCosmeticsDto } from "../profile/types";

export interface AdminAuditRow {
  id: string;
  actorUserId: string | null;
  actorUsername: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  metadataJson: string | null;
  createdAt: number;
}

export interface AdminOverviewSnapshot {
  openReports: number;
  pendingVerificationCandidates: number;
  publishedStoreItems: number;
  draftStoreItems: number;
  flaggedCatalogItems: number;
  recentAudit: AdminAuditRow[];
}

export interface AdminUserRow {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  cosmetics?: PublicCosmeticsDto;
  status: string;
  createdAt: number;
  lastSeenAt: number | null;
  roles: string[];
}

export interface AdminRoleRow {
  id: string;
  slug: string;
  name: string;
  rank: number;
  isSystem: boolean;
  capabilities: string[];
  assignmentCount: number;
}

export interface AdminAuditFilters {
  actor?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: number;
  to?: number;
  limit?: number;
}

export interface AdminReadService {
  overview(): Promise<AdminOverviewSnapshot>;
  users(query: string, limit?: number): Promise<AdminUserRow[]>;
  roles(): Promise<AdminRoleRow[]>;
  audit(filters: AdminAuditFilters): Promise<AdminAuditRow[]>;
}
