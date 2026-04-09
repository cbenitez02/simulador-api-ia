import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type {
  CreateProjectDto,
  DashboardSummaryDto,
  EndpointDto,
  ProjectDto,
  UpdateProjectDto,
} from '../../../shared/http/api.types';
import type { DashboardProject } from '../models/dashboard-project.model';
import { mapCreatedProjectPlaceholder, mapDashboardProjectFromApi } from '../adapters/project-api.mapper';
import { mapEndpointSummaryFromApi } from '../../endpoints/adapters/endpoint-api.mapper';

@Injectable({ providedIn: 'root' })
export class ProjectsRepository {
  private readonly api = inject(ApiClient);

  async listProjects(): Promise<DashboardProject[]> {
    const projects = await this.api.get<ProjectDto[]>('/projects');

    return Promise.all(
      projects.map(async (project) => {
        const endpoints = await this.api.get<EndpointDto[]>(`/projects/${project.id}/endpoints`);
        return {
          ...mapCreatedProjectPlaceholder(project),
          endpoints: endpoints.map(mapEndpointSummaryFromApi),
          metrics: {
            totalEndpoints: endpoints.length,
            totalScenarios: 0,
            avgLatencyMs:
              endpoints.length > 0
                ? Math.round(
                    endpoints.reduce((sum, endpoint) => sum + (endpoint.endpointConfig?.fixedDelayMs ?? 0), 0) /
                      endpoints.length,
                  )
                : 0,
            errorRatePct: 0,
            totalRequests: 0,
          },
        };
      }),
    );
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
