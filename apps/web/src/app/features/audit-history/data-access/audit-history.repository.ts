import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type { ApiAuditEventListDto } from '../../../shared/http/api.types';
import { mapAuditHistoryListFromApi } from '../adapters/audit-history-api.mapper';
import type { AuditHistoryListResult, ListAuditHistoryQuery } from '../models/audit-history.model';

@Injectable({ providedIn: 'root' })
export class AuditHistoryRepository {
  private readonly api = inject(ApiClient);

  async listEvents(projectId: string, query: ListAuditHistoryQuery = {}): Promise<AuditHistoryListResult> {
    const params = new URLSearchParams();

    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.direction) params.set('direction', query.direction);
    if (query.cursorCreatedAt) params.set('cursorCreatedAt', query.cursorCreatedAt);
    if (query.cursorId) params.set('cursorId', query.cursorId);
    if (query.resourceType) params.set('resourceType', query.resourceType);
    if (query.action) params.set('action', query.action);

    const queryString = params.size > 0 ? `?${params.toString()}` : '';
    const response = await this.api.get<ApiAuditEventListDto>(`/projects/${projectId}/audit-events${queryString}`);
    return mapAuditHistoryListFromApi(response);
  }
}
