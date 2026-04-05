import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type { ApiLogDto } from '../../../shared/http/api.types';
import type { ApiLogEntry } from '../models/api-log.model';
import { mapLogFromApi } from '../adapters/logs-api.mapper';

@Injectable({ providedIn: 'root' })
export class LogsRepository {
  private readonly api = inject(ApiClient);

  async listLogs(projectId: string): Promise<ApiLogEntry[]> {
    const logs = await this.api.get<ApiLogDto[]>(`/projects/${projectId}/logs`);
    return logs.map(mapLogFromApi);
  }

  async clearLogs(projectId: string): Promise<void> {
    await this.api.delete(`/projects/${projectId}/logs`);
  }
}
