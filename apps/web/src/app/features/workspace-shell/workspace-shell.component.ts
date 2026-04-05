import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CreateEndpointPageComponent } from '../endpoints/components/create-endpoint-page/create-endpoint-page.component';
import { EndpointDetailPanelComponent } from '../endpoints/components/endpoint-detail-panel/endpoint-detail-panel.component';
import { EndpointsPageComponent } from '../endpoints/endpoints-page.component';
import { endpointPreviewToDraft } from '../endpoints/services/endpoint-draft.mapper';
import { LogsComponent } from '../logs/logs.component';
import { LogsDetailSidebarComponent } from '../logs/components/logs-detail-sidebar/logs-detail-sidebar.component';
import { DashboardEmptyStateComponent } from '../main-dashboard/components/dashboard-empty-state/dashboard-empty-state.component';
import { MainDashboardDataComponent } from '../main-dashboard/components/main-dashboard-data/main-dashboard-data.component';
import { MainDashboardSidebarComponent } from '../main-dashboard/components/main-dashboard-sidebar/main-dashboard-sidebar.component';
import { MainDashboardUtilitySidebarComponent } from '../main-dashboard/components/main-dashboard-utility-sidebar/main-dashboard-utility-sidebar.component';
import { GlobalConfigDrawerComponent } from '../global-config/components/global-config-drawer/global-config-drawer.component';
import { createDefaultGlobalConfig, type GlobalConfig } from '../global-config/models/global-config.model';
import { GlobalConfigRepository } from '../global-config/data-access/global-config.repository';
import { CreateProjectModalComponent } from '../../shared/ui/create-project-modal/create-project-modal.component';
import type {
  CreateProjectModalPayload,
  CreateProjectWithEndpointPayload,
} from '../../shared/ui/create-project-modal/create-project-modal.model';
import type { DashboardProject } from '../main-dashboard/models/dashboard-project.model';
import type { SidebarProjectRow, WorkspaceNavId } from './models/workspace-shell.model';
import type { ApiLogEntry } from '../logs/models/api-log.model';
import type { EndpointPreview } from '../../shared/models/endpoint-preview.model';
import { ProjectsRepository } from '../main-dashboard/data-access/projects.repository';
import { EndpointsRepository } from '../endpoints/data-access/endpoints.repository';

@Component({
  selector: 'app-workspace-shell',
  standalone: true,
  imports: [
    CreateEndpointPageComponent,
    EndpointDetailPanelComponent,
    EndpointsPageComponent,
    LogsComponent,
    LogsDetailSidebarComponent,
    DashboardEmptyStateComponent,
    MainDashboardDataComponent,
    MainDashboardSidebarComponent,
    MainDashboardUtilitySidebarComponent,
    GlobalConfigDrawerComponent,
    CreateProjectModalComponent,
  ],
  templateUrl: './workspace-shell.component.html',
  styleUrls: ['./workspace-shell.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShellComponent {
  private readonly projectsRepository = inject(ProjectsRepository);
  private readonly endpointsRepository = inject(EndpointsRepository);
  private readonly globalConfigRepository = inject(GlobalConfigRepository);

  protected readonly projects = signal<DashboardProject[]>([]);
  protected readonly projectsLoading = signal(true);
  protected readonly projectsError = signal<string | null>(null);
  protected readonly selectedProjectId = signal<string>('');
  protected readonly activeNav = signal<WorkspaceNavId>('dashboard');

  protected readonly sidebarProjects = computed((): SidebarProjectRow[] =>
    this.projects().map((p) => ({
      id: p.id,
      name: p.name,
      mockUrl: p.mockUrl,
      endpointCount: p.endpoints.length,
    })),
  );

  protected readonly hasProjects = computed(() => this.projects().length > 0);

  protected readonly activeProject = computed((): DashboardProject | null => {
    const list = this.projects();
    if (!list.length) return null;
    const id = this.selectedProjectId();
    return list.find((p) => p.id === id) ?? list[0] ?? null;
  });

  protected readonly endpoints = computed(() => this.activeProject()?.endpoints ?? []);
  protected readonly apiBaseUrl = computed(() => this.activeProject()?.mockUrl ?? '');
  protected readonly selectedEndpointId = signal<string | null>(null);
  protected readonly endpointMutationPending = signal(false);
  protected readonly endpointMutationError = signal<string | null>(null);

  protected readonly selectedLog = signal<ApiLogEntry | null>(null);

  protected readonly globalConfigDrawerOpen = signal(false);
  protected readonly globalConfig = signal<GlobalConfig>(createDefaultGlobalConfig());
  protected readonly globalConfigLoading = signal(false);
  protected readonly globalConfigSaving = signal(false);
  protected readonly globalConfigError = signal<string | null>(null);

  protected readonly createProjectModalOpen = signal(false);
  protected readonly createProjectModalLoading = signal(false);
  protected readonly createProjectError = signal<string | null>(null);

  protected readonly createEndpointFlowOpen = signal(false);
  protected readonly endpointWizardInitial = signal<EndpointPreview | null>(null);
  protected readonly navBeforeCreateFlow = signal<WorkspaceNavId | null>(null);

  protected readonly selectedEndpoint = computed((): EndpointPreview | null => {
    const id = this.selectedEndpointId();
    if (!id) return null;
    return this.endpoints().find((e) => e.id === id) ?? null;
  });

  protected readonly placeholderTitle = computed(() => (this.activeNav() === 'settings' ? 'Settings' : ''));
  protected readonly placeholderSub = computed(() =>
    this.activeNav() === 'settings' ? 'Workspace and simulator preferences.' : '',
  );
  protected readonly placeholderLabel = computed(() => this.placeholderTitle() || 'Section');

  constructor() {
    void this.reloadProjects();
  }

  protected openCreateProjectModal(): void {
    this.createProjectError.set(null);
    this.createProjectModalOpen.set(true);
  }

  protected onCreateProjectModalDismiss(): void {
    if (this.createProjectModalLoading()) return;
    this.createProjectModalOpen.set(false);
    this.createProjectError.set(null);
  }

  protected onCreateProjectModalProjectOnly(payload: CreateProjectModalPayload): void {
    void this.createProject(payload);
  }

  protected onCreateProjectModalWithEndpoint(payload: CreateProjectWithEndpointPayload): void {
    void this.createProject(payload, payload.endpointPrompt);
  }

  protected createBlankProject(): void {
    void this.createProject({
      name: this.projects().length === 0 ? 'My first project' : 'New project',
      description: 'Your mock API workspace.',
    });
  }

  protected loadDemoProject(): void {
    void this.createProject(
      { name: 'Demo: Users API', description: 'Sample users endpoint generated for the demo.' },
      'GET /users',
    );
  }

  protected selectProject(id: string): void {
    const project = this.projects().find((item) => item.id === id);
    if (!project) return;
    this.selectedProjectId.set(project.id);
    const selectedEndpointId = this.selectedEndpointId();
    if (selectedEndpointId && !project.endpoints.some((endpoint) => endpoint.id === selectedEndpointId)) {
      this.selectedEndpointId.set(null);
    }
    this.selectedLog.set(null);
    this.endpointMutationError.set(null);
    this.closeCreateEndpointWizard(true);
  }

  protected selectNav(id: WorkspaceNavId): void {
    this.activeNav.set(id);
    if (id !== 'endpoints') {
      this.selectedEndpointId.set(null);
      this.createEndpointFlowOpen.set(false);
      this.endpointWizardInitial.set(null);
      this.navBeforeCreateFlow.set(null);
    }
    if (id !== 'logs') {
      this.selectedLog.set(null);
    }
  }

  protected selectEndpoint(id: string): void {
    this.selectedEndpointId.set(id);
  }

  protected clearEndpointSelection(): void {
    this.selectedEndpointId.set(null);
  }

  protected clearLogSelection(): void {
    this.selectedLog.set(null);
  }

  protected createEndpoint(): void {
    if (!this.hasProjects()) return;
    this.endpointMutationError.set(null);
    this.navBeforeCreateFlow.set(this.activeNav());
    this.activeNav.set('endpoints');
    this.selectedEndpointId.set(null);
    this.endpointWizardInitial.set(null);
    this.createEndpointFlowOpen.set(true);
  }

  protected editEndpoint(ep: EndpointPreview): void {
    if (!this.hasProjects()) return;
    this.endpointMutationError.set(null);
    this.navBeforeCreateFlow.set(this.activeNav());
    this.activeNav.set('endpoints');
    this.endpointWizardInitial.set(ep);
    this.createEndpointFlowOpen.set(true);
  }

  protected closeCreateEndpointWizard(restorePreviousNav = false): void {
    this.createEndpointFlowOpen.set(false);
    this.endpointWizardInitial.set(null);
    if (restorePreviousNav) {
      const prev = this.navBeforeCreateFlow();
      if (prev !== null) this.activeNav.set(prev);
    }
    this.navBeforeCreateFlow.set(null);
  }

  protected onEndpointSaved(ep: EndpointPreview): void {
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (!projectId) return;
    this.selectedEndpointId.set(ep.id);
    this.activeNav.set('endpoints');
    this.closeCreateEndpointWizard(false);
    void this.refreshProject(projectId);
  }

  protected deleteEndpoint(endpointId: string): void {
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (!projectId || this.endpointMutationPending()) return;
    void this.deleteEndpointRemote(projectId, endpointId);
  }

  protected openLogs(): void {
    this.activeNav.set('logs');
  }

  protected testAllEndpoints(): void {}

  protected exportConfig(): void {}

  protected importEndpoints(): void {}

  protected editGlobalConfig(): void {
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (!projectId) return;
    this.globalConfigDrawerOpen.set(true);
    this.globalConfigLoading.set(true);
    this.globalConfigError.set(null);
    void this.loadGlobalConfig(projectId);
  }

  protected onGlobalConfigDrawerClose(): void {
    if (this.globalConfigSaving()) return;
    this.globalConfigDrawerOpen.set(false);
  }

  protected onGlobalConfigSaved(cfg: GlobalConfig): void {
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (!projectId || this.globalConfigSaving()) return;
    this.globalConfigSaving.set(true);
    this.globalConfigError.set(null);
    void this.saveGlobalConfig(projectId, cfg);
  }

  protected retryLoadProjects(): void {
    void this.reloadProjects();
  }

  private async reloadProjects(selectProjectId?: string): Promise<void> {
    this.projectsLoading.set(true);
    this.projectsError.set(null);
    try {
      const projects = await this.projectsRepository.listProjects();
      this.projects.set(projects);

      const currentSelected = selectProjectId ?? this.selectedProjectId();
      const nextSelected = projects.find((project) => project.id === currentSelected)?.id ?? projects[0]?.id ?? '';
      this.selectedProjectId.set(nextSelected);

      if (
        !projects.some((project) => project.endpoints.some((endpoint) => endpoint.id === this.selectedEndpointId()))
      ) {
        this.selectedEndpointId.set(null);
      }
    } catch (error) {
      this.projects.set([]);
      this.selectedProjectId.set('');
      this.projectsError.set(error instanceof Error ? error.message : 'Could not load projects.');
    } finally {
      this.projectsLoading.set(false);
    }
  }

  private async refreshProject(projectId: string): Promise<void> {
    try {
      const refreshed = await this.projectsRepository.getProject(projectId);
      this.projects.update((projects) => projects.map((project) => (project.id === projectId ? refreshed : project)));
    } catch (error) {
      this.endpointMutationError.set(error instanceof Error ? error.message : 'Could not refresh project data.');
    }
  }

  private async createProject(payload: CreateProjectModalPayload, endpointPrompt?: string): Promise<void> {
    this.createProjectModalLoading.set(true);
    this.createProjectError.set(null);
    try {
      const createdProject = await this.projectsRepository.createProject(payload);
      if (endpointPrompt?.trim()) {
        const preview = this.buildStubEndpointFromPrompt(endpointPrompt);
        await this.endpointsRepository.saveEndpoint(createdProject.id, endpointPreviewToDraft(preview));
      }

      await this.reloadProjects(createdProject.id);
      this.createProjectModalOpen.set(false);
      this.selectedLog.set(null);
      this.closeCreateEndpointWizard(true);
    } catch (error) {
      this.createProjectError.set(error instanceof Error ? error.message : 'Could not create project.');
    } finally {
      this.createProjectModalLoading.set(false);
    }
  }

  private buildStubEndpointFromPrompt(prompt: string): EndpointPreview {
    const trimmed = prompt.trim();
    const match = trimmed.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/i);
    const method = (match?.[1]?.toUpperCase() as EndpointPreview['method']) || 'GET';
    let path = (match?.[2] ?? '/generated').replace(/['"`]/g, '');
    if (!path.startsWith('/')) path = `/${path}`;

    return {
      id: `ep-${Date.now().toString(36)}`,
      method,
      path,
      description: trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed || 'Generated endpoint',
      latencyMs: 120,
      statusCode: 200,
      responseBody: { _mock: true, note: 'Placeholder response — replace in editor.' },
      responseHeaders: { 'content-type': 'application/json' },
      config: {
        latencyMs: 120,
        errorRatePct: 0,
        scenarios: { success: true, empty: false, error: false, timeout: false },
      },
    };
  }

  private async deleteEndpointRemote(projectId: string, endpointId: string): Promise<void> {
    this.endpointMutationPending.set(true);
    this.endpointMutationError.set(null);
    try {
      await this.endpointsRepository.deleteEndpoint(projectId, endpointId);
      if (this.selectedEndpointId() === endpointId) this.selectedEndpointId.set(null);
      await this.refreshProject(projectId);
    } catch (error) {
      this.endpointMutationError.set(error instanceof Error ? error.message : 'Could not delete endpoint.');
    } finally {
      this.endpointMutationPending.set(false);
    }
  }

  private async loadGlobalConfig(projectId: string): Promise<void> {
    try {
      const config = await this.globalConfigRepository.getConfig(projectId);
      this.globalConfig.set(config);
    } catch (error) {
      this.globalConfigError.set(error instanceof Error ? error.message : 'Could not load global config.');
    } finally {
      this.globalConfigLoading.set(false);
    }
  }

  private async saveGlobalConfig(projectId: string, config: GlobalConfig): Promise<void> {
    try {
      const saved = await this.globalConfigRepository.saveConfig(projectId, config);
      this.globalConfig.set(saved);
      this.globalConfigDrawerOpen.set(false);
    } catch (error) {
      this.globalConfigError.set(error instanceof Error ? error.message : 'Could not save global config.');
    } finally {
      this.globalConfigSaving.set(false);
    }
  }
}
