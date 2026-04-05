import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type { GlobalConfigDto } from '../../../shared/http/api.types';
import type { GlobalConfig } from '../models/global-config.model';
import { mapGlobalConfigFromApi, mapGlobalConfigToApi } from '../adapters/global-config-api.mapper';

@Injectable({ providedIn: 'root' })
export class GlobalConfigRepository {
  private readonly api = inject(ApiClient);

  async getConfig(projectId: string): Promise<GlobalConfig> {
    const config = await this.api.get<GlobalConfigDto>(`/projects/${projectId}/config`);
    return mapGlobalConfigFromApi(config);
  }

  async saveConfig(projectId: string, config: GlobalConfig): Promise<GlobalConfig> {
    const saved = await this.api.put<GlobalConfigDto, ReturnType<typeof mapGlobalConfigToApi>>(
      `/projects/${projectId}/config`,
      mapGlobalConfigToApi(config),
    );

    return mapGlobalConfigFromApi(saved);
  }
}
