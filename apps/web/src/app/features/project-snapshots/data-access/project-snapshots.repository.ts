import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type {
  CreateProjectSnapshotDto,
  ProjectSnapshotDetailDto,
  ProjectSnapshotListDto,
  RestoreProjectSnapshotResponseDto,
} from '../../../shared/http/api.types';
import { mapProjectSnapshotDetailFromApi, mapProjectSnapshotFromApi } from '../adapters/project-snapshot-api.mapper';

@Injectable({ providedIn: 'root' })
export class ProjectSnapshotsRepository {
  private readonly api = inject(ApiClient);

  async list(projectId: string) {
    const response = await this.api.get<ProjectSnapshotListDto>(`/projects/${projectId}/snapshots`);
    return { items: response.items.map(mapProjectSnapshotFromApi) };
  }

  async get(projectId: string, snapshotId: string) {
    const response = await this.api.get<ProjectSnapshotDetailDto>(`/projects/${projectId}/snapshots/${snapshotId}`);
    return mapProjectSnapshotDetailFromApi(response);
  }

  async create(projectId: string, input: CreateProjectSnapshotDto) {
    const response = await this.api.post<
      ProjectSnapshotDetailDto | ProjectSnapshotListDto['items'][number],
      CreateProjectSnapshotDto
    >(`/projects/${projectId}/snapshots`, input);
    return mapProjectSnapshotFromApi(response as ProjectSnapshotListDto['items'][number]);
  }

  restore(projectId: string, snapshotId: string) {
    return this.api.post<RestoreProjectSnapshotResponseDto, Record<string, never>>(
      `/projects/${projectId}/snapshots/${snapshotId}/restore`,
      {},
    );
  }
}
