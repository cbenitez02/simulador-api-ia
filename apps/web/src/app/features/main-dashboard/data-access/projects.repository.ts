import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type { CreateProjectDto, EndpointDto, ProjectDto, UpdateProjectDto } from '../../../shared/http/api.types';
import type { DashboardProject } from '../models/dashboard-project.model';
import { mapDashboardProjectFromApi } from '../adapters/project-api.mapper';

@Injectable({ providedIn: 'root' })
export class ProjectsRepository {
  private readonly api = inject(ApiClient);

  async listProjects(): Promise<DashboardProject[]> {
    const projects = await this.api.get<ProjectDto[]>('/projects');

    return Promise.all(
      projects.map(async (project) => {
        const endpoints = await this.api.get<EndpointDto[]>(`/projects/${project.id}/endpoints`);
        return mapDashboardProjectFromApi(project, endpoints);
      }),
    );
  }

  async createProject(input: CreateProjectDto): Promise<DashboardProject> {
    const project = await this.api.post<ProjectDto, CreateProjectDto>('/projects', input);
    const endpoints = await this.api.get<EndpointDto[]>(`/projects/${project.id}/endpoints`);
    return mapDashboardProjectFromApi(project, endpoints);
  }

  async getProject(projectId: string): Promise<DashboardProject> {
    const project = await this.api.get<ProjectDto>(`/projects/${projectId}`);
    const endpoints = await this.api.get<EndpointDto[]>(`/projects/${projectId}/endpoints`);
    return mapDashboardProjectFromApi(project, endpoints);
  }

  async updateProject(projectId: string, input: UpdateProjectDto): Promise<DashboardProject> {
    const project = await this.api.patch<ProjectDto, UpdateProjectDto>(`/projects/${projectId}`, input);
    const endpoints = await this.api.get<EndpointDto[]>(`/projects/${projectId}/endpoints`);
    return mapDashboardProjectFromApi(project, endpoints);
  }

  deleteProject(projectId: string): Promise<void> {
    return this.api.delete(`/projects/${projectId}`);
  }
}
