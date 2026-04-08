import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type { ApiLogListDto } from '../../../shared/http/api.types';
import type { ApiLogListResult, ListLogsQuery } from '../models/api-log.model';
import { mapLogListFromApi } from '../adapters/logs-api.mapper';

@Injectable({ providedIn: 'root' })
export class LogsRepository {
  private readonly api = inject(ApiClient);

  async listLogs(projectId: string, query: ListLogsQuery = {}): Promise<ApiLogListResult> {
    const params = new URLSearchParams();

    if (query.limit !== undefined) {
      params.set('limit', String(query.limit));
    }

    if (query.cursorCreatedAt) {
      params.set('cursorCreatedAt', query.cursorCreatedAt);
    }

    if (query.cursorId) {
      params.set('cursorId', query.cursorId);
    }

    const queryString = params.size > 0 ? `?${params.toString()}` : '';
    const logs = await this.api.get<ApiLogListDto>(`/projects/${projectId}/logs${queryString}`);
    return mapLogListFromApi(logs);
  }

  async clearLogs(projectId: string): Promise<void> {
    await this.api.delete(`/projects/${projectId}/logs`);
  }
}
