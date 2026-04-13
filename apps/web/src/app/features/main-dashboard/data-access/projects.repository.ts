import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type {
  CreateProjectDto,
  DashboardSummaryDto,
  ProjectDto,
  UpdateProjectDto,
} from '../../../shared/http/api.types';
import type { DashboardProject } from '../models/dashboard-project.model';
import { mapCreatedProjectPlaceholder, mapDashboardProjectFromApi } from '../adapters/project-api.mapper';

@Injectable({ providedIn: 'root' })
export class ProjectsRepository {
  private readonly api = inject(ApiClient);

  async listProjects(): Promise<DashboardProject[]> {
    const projects = await this.api.get<ProjectDto[]>('/projects');

    return projects.map(mapCreatedProjectPlaceholder);
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
