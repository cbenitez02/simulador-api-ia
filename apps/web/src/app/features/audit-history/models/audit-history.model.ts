export type AuditResourceType = 'project' | 'endpoint' | 'scenario' | 'global-config' | 'endpoint-config';
export type AuditAction = 'created' | 'updated' | 'deleted';

export interface AuditHistoryActor {
  userId: string;
  email: string | null;
  displayName: string | null;
}

export interface AuditHistoryCursor {
  createdAt: string;
  id: string;
}

export interface AuditHistoryEntry {
  id: string;
  actor: AuditHistoryActor;
  actorLabel: string;
  workspaceId: string;
  projectId: string;
  resourceType: AuditResourceType;
  resourceId: string;
  resourceLabel: string;
  action: AuditAction;
  summary: string;
  metadata: unknown;
  createdAt: string;
  timeLabel: string;
}

export interface AuditHistoryListResult {
  items: AuditHistoryEntry[];
  nextCursor: AuditHistoryCursor | null;
  serverTime: string;
}

export interface ListAuditHistoryQuery {
  limit?: number;
  direction?: 'older' | 'newer';
  cursorCreatedAt?: string;
  cursorId?: string;
  resourceType?: AuditResourceType;
  action?: AuditAction;
}
