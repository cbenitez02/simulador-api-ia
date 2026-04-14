import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type {
  CreateProjectDto,
  DashboardSummaryDto,
  PagedResponseDto,
  ProjectDto,
  UpdateProjectDto,
} from '../../../shared/http/api.types';
import type { DashboardProject } from '../models/dashboard-project.model';
import { mapCreatedProjectPlaceholder, mapDashboardProjectFromApi } from '../adapters/project-api.mapper';

export interface ProjectListQuery {
  limit?: number;
  offset?: number;
  q?: string;
}

export interface PagedProjectsResult {
  items: DashboardProject[];
  page: PagedResponseDto<ProjectDto>['page'];
}

function buildProjectsQueryString(query: ProjectListQuery = {}): string {
  const params = new URLSearchParams();

  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));
  if (query.q?.trim()) params.set('q', query.q.trim());

  const text = params.toString();
  return text ? `?${text}` : '';
}

@Injectable({ providedIn: 'root' })
export class ProjectsRepository {
  private readonly api = inject(ApiClient);

  async listProjects(query: ProjectListQuery = {}): Promise<PagedProjectsResult> {
    const response = await this.api.get<PagedResponseDto<ProjectDto>>(`/projects${buildProjectsQueryString(query)}`);

    return {
      items: response.items.map(mapCreatedProjectPlaceholder),
      page: response.page,
    };
  }

  async createProject(input: CreateProjectDto): Promise<DashboardProject> {
    const project = await this.api.post<ProjectDto, CreateProjectDto>('/projects', input);
    const summary = await this.api.get<DashboardSummaryDto>(`/projects/${project.id}/dashboard-summary`);
    return mapDashboardProjectFromApi(summary);
  }

  async getProject(projectId: string): Promise<DashboardProject> {
    const summary = await this.api.get<DashboardSummaryDto>(`/projects/${projectId}/dashboard-summary`);
    return mapDashboardProjectFromApi(summary);
  }

  async updateProject(projectId: string, input: UpdateProjectDto): Promise<DashboardProject> {
    await this.api.patch<ProjectDto, UpdateProjectDto>(`/projects/${projectId}`, input);
    const summary = await this.api.get<DashboardSummaryDto>(`/projects/${projectId}/dashboard-summary`);
    return mapDashboardProjectFromApi(summary);
  }

  deleteProject(projectId: string): Promise<void> {
    return this.api.delete(`/projects/${projectId}`);
  }
}
