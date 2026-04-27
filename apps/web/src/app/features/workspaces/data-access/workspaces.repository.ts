import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type { WorkspaceListDto, WorkspaceSummaryDto } from '../../../shared/http/api.types';

@Injectable({ providedIn: 'root' })
export class WorkspacesRepository {
  private readonly api = inject(ApiClient);

  async listWorkspaces(): Promise<WorkspaceSummaryDto[]> {
    const response = await this.api.get<WorkspaceListDto>('/workspaces');
    return response.items;
  }
}
