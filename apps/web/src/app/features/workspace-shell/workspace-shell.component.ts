import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiError } from '../../shared/http/api-error.mapper';
import { FrontendAuthSessionService } from '../../shared/auth/frontend-auth-session.service';
import type { EndpointPreview } from '../../shared/models/endpoint-preview.model';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { CreateProjectModalComponent } from '../../shared/ui/create-project-modal/create-project-modal.component';
import type {
  CreateProjectModalPayload,
  CreateProjectWithEndpointPayload,
  EditProjectModalPayload,
  ProjectModalInitialValues,
  ProjectModalMode,
} from '../../shared/ui/create-project-modal/create-project-modal.model';
import { CreateEndpointPageComponent } from '../endpoints/components/create-endpoint-page/create-endpoint-page.component';
import { EndpointDetailPanelComponent } from '../endpoints/components/endpoint-detail-panel/endpoint-detail-panel.component';
import { EndpointsRepository } from '../endpoints/data-access/endpoints.repository';
import { EndpointsPageComponent } from '../endpoints/endpoints-page.component';
import type { EndpointDraft } from '../endpoints/models/endpoint-draft.model';
import { GlobalConfigDrawerComponent } from '../global-config/components/global-config-drawer/global-config-drawer.component';
import { GlobalConfigRepository } from '../global-config/data-access/global-config.repository';
import { createDefaultGlobalConfig, type GlobalConfig } from '../global-config/models/global-config.model';
import { LogsDetailSidebarComponent } from '../logs/components/logs-detail-sidebar/logs-detail-sidebar.component';
import { LogsComponent } from '../logs/logs.component';
import type { ApiLogEntry } from '../logs/models/api-log.model';
import { DashboardEmptyStateComponent } from '../main-dashboard/components/dashboard-empty-state/dashboard-empty-state.component';
import { MainDashboardDataComponent } from '../main-dashboard/components/main-dashboard-data/main-dashboard-data.component';
import { MainDashboardSidebarComponent } from '../main-dashboard/components/main-dashboard-sidebar/main-dashboard-sidebar.component';
import { MainDashboardUtilitySidebarComponent } from '../main-dashboard/components/main-dashboard-utility-sidebar/main-dashboard-utility-sidebar.component';
import { ProjectsRepository } from '../main-dashboard/data-access/projects.repository';
import type { DashboardProject } from '../main-dashboard/models/dashboard-project.model';
import type {
  EndpointListMethodFilter,
  EndpointsListSortOption,
} from '../endpoints/components/endpoints-list/endpoints-list.constants';
import type {
  CreateProjectAiFlowState,
  EndpointListState,
  PaginationState,
  SidebarProjectPaginationState,
  SidebarProjectRow,
  WorkspaceNavId,
} from './models/workspace-shell.model';

interface ExportedWorkspaceProjectConfig {
  version: 1;
  exportedAt: string;
  projectId: string;
  projectSlug: string;
  globalConfig: GlobalConfig;
  endpoints: EndpointDraft[];
}

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
    ConfirmDialogComponent,
  ],
  templateUrl: './workspace-shell.component.html',
  styleUrls: ['./workspace-shell.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShellComponent {
  private static readonly PROJECT_PAGE_LIMIT = 25;
  private static readonly ENDPOINT_PAGE_LIMIT = 25;

  private readonly authSession = inject(FrontendAuthSessionService);
  private readonly projectsRepository = inject(ProjectsRepository);
  private readonly endpointsRepository = inject(EndpointsRepository);
  private readonly globalConfigRepository = inject(GlobalConfigRepository);

  protected readonly projects = signal<DashboardProject[]>([]);
  protected readonly projectsPage = signal<PaginationState>({ limit: 25, offset: 0, total: 0, hasMore: false });
  protected readonly authSnapshot = this.authSession.snapshot;
  protected readonly protectedApiAccessState = this.authSession.accessState;
  protected readonly projectsLoading = signal(true);
  protected readonly projectsLoadingMore = signal(false);
  protected readonly projectsError = signal<string | null>(null);
  protected readonly projectsLoadMoreError = signal<string | null>(null);
  protected readonly selectedProjectId = signal<string>('');
  protected readonly activeNav = signal<WorkspaceNavId>('dashboard');

  protected readonly sidebarProjects = computed((): SidebarProjectRow[] =>
    this.projects().map((p) => ({
      id: p.id,
      name: p.name,
      mockUrl: p.mockUrl,
      endpointCount: p.metrics.totalEndpoints,
    })),
  );
  protected readonly sidebarProjectPagination = computed(
    (): SidebarProjectPaginationState => ({
      loaded: this.projects().length,
      total: this.projectsPage().total,
      hasMore: this.projectsPage().hasMore,
      loadingMore: this.projectsLoadingMore(),
      errorMessage: this.projectsLoadMoreError(),
    }),
  );

  protected readonly hasProjects = computed(() => this.projects().length > 0);
  protected readonly showProtectedApiBoundary = computed(
    () => this.protectedApiAccessState() !== 'ready' || this.authSnapshot().state !== 'authenticated',
  );
  protected readonly protectedApiBoundaryTitle = computed(() => {
    if (this.authSnapshot().state === 'misconfigured') return 'Frontend auth is not configured';
    if (this.authSnapshot().state === 'error') return 'Could not initialize secure session';
    if (this.protectedApiAccessState() === 'unauthorized') return 'You do not have access to this workspace';
    if (this.authSnapshot().state === 'loading') return 'Initializing secure session';
    return 'Sign in is required to load your workspace';
  });
  protected readonly protectedApiBoundaryDescription = computed(() => {
    if (this.authSnapshot().state === 'misconfigured') {
      return 'Set clerkPublishableKey in the frontend runtime config so the Angular app can attach Clerk-backed management headers.';
    }

    if (this.authSnapshot().state === 'error') {
      return this.authSnapshot().reason ?? 'The Clerk SDK could not initialize.';
    }

    if (this.protectedApiAccessState() === 'unauthorized') {
      return 'The backend accepted your identity but denied workspace access. Sign in with a different Clerk user or ask for workspace membership.';
    }

    if (this.authSnapshot().state === 'loading') {
      return 'We are preparing your authenticated browser session before loading protected API data.';
    }

    return this.authSnapshot().reason ?? 'Sign in first so the frontend can call the protected management API.';
  });

  protected readonly activeProject = computed((): DashboardProject | null => {
    const list = this.projects();
    if (!list.length) return null;
    const id = this.selectedProjectId();
    return list.find((p) => p.id === id) ?? list[0] ?? null;
  });

  protected readonly endpointList = signal<EndpointPreview[]>([]);
  protected readonly endpointListLoading = signal(false);
  protected readonly endpointListError = signal<string | null>(null);
  protected readonly endpointListState = signal<EndpointListState>({
    limit: 25,
    offset: 0,
    total: 0,
    hasMore: false,
    q: '',
    method: 'all',
    sort: 'path-asc',
  });
  protected readonly endpoints = computed(() => this.endpointList());
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
  protected readonly createProjectPartialState = signal<CreateProjectAiFlowState | null>(null);

  protected readonly editProjectModalOpen = signal(false);
  protected readonly editProjectModalLoading = signal(false);
  protected readonly editProjectError = signal<string | null>(null);
  protected readonly editProjectTargetId = signal<string | null>(null);
  protected readonly editProjectInitialValues = signal<ProjectModalInitialValues | null>(null);

  protected readonly deleteProjectDialogOpen = signal(false);
  protected readonly deleteProjectPending = signal(false);
  protected readonly deleteProjectError = signal<string | null>(null);
  protected readonly deleteProjectTargetId = signal<string | null>(null);
  protected readonly deleteProjectTargetName = signal('');

  protected readonly createEndpointFlowOpen = signal(false);
  protected readonly endpointWizardInitial = signal<EndpointPreview | null>(null);
  protected readonly navBeforeCreateFlow = signal<WorkspaceNavId | null>(null);
  private activeSummaryRequestId = 0;

  protected readonly selectedEndpoint = computed((): EndpointPreview | null => {
    const id = this.selectedEndpointId();
    if (!id) return null;
    return this.endpoints().find((e) => e.id === id) ?? null;
  });

  protected readonly projectModalOpen = computed(() => this.createProjectModalOpen() || this.editProjectModalOpen());
  protected readonly projectModalMode = computed<ProjectModalMode>(() =>
    this.editProjectModalOpen() ? 'edit' : 'create',
  );
  protected readonly projectModalLoading = computed(() =>
    this.editProjectModalOpen() ? this.editProjectModalLoading() : this.createProjectModalLoading(),
  );
  protected readonly projectModalError = computed(() =>
    this.editProjectModalOpen() ? this.editProjectError() : this.createProjectError(),
  );
  protected readonly projectModalInitialValues = computed(() =>
    this.editProjectModalOpen() ? this.editProjectInitialValues() : null,
  );
  protected readonly deleteProjectMessage = computed(() => {
    const projectName = this.deleteProjectTargetName();
    if (!projectName) return '';

    return `Delete “${projectName}” permanently? This removes its endpoints, scenarios, config, and logs. This action cannot be undone.`;
  });

  constructor() {
    void this.authSession.bootstrap();
    void this.reloadProjects();
  }

  protected openSignIn(): void {
    void this.authSession.openSignIn();
  }

  protected signOut(): void {
    void this.authSession.signOut();
  }

  protected openCreateProjectModal(): void {
    this.createProjectError.set(null);
    this.createProjectPartialState.set(null);
    this.createProjectModalOpen.set(true);
  }

  protected openEditProjectModal(): void {
    const project = this.activeProject();
    if (!project) return;

    this.editProjectTargetId.set(project.id);
    this.editProjectInitialValues.set({
      name: project.name,
      description: project.description,
    });
    this.editProjectError.set(null);
    this.editProjectModalOpen.set(true);
  }

  protected onProjectModalDismiss(): void {
    if (this.projectModalLoading()) return;

    if (this.editProjectModalOpen()) {
      this.editProjectModalOpen.set(false);
      this.editProjectError.set(null);
      this.editProjectTargetId.set(null);
      this.editProjectInitialValues.set(null);
      return;
    }

    if (this.createProjectModalLoading()) return;
    this.createProjectModalOpen.set(false);
    this.createProjectError.set(null);
    this.createProjectPartialState.set(null);
  }

  protected onCreateProjectModalProjectOnly(payload: CreateProjectModalPayload): void {
    this.createProjectModalOpen.set(true);
    void this.createProject(payload);
  }

  protected onCreateProjectModalWithEndpoint(payload: CreateProjectWithEndpointPayload): void {
    this.createProjectModalOpen.set(true);
    void this.createProject({ name: payload.name, description: payload.description }, payload.endpointPrompt);
  }

  protected retryCreateProjectEndpointGeneration(): void {
    const partial = this.createProjectPartialState();
    if (!partial || this.createProjectModalLoading()) return;
    void this.generateFirstEndpointForProject(partial.createdProjectId, partial.projectName, partial.endpointPrompt);
  }

  protected continueCreateProjectManually(): void {
    const partial = this.createProjectPartialState();
    if (!partial || this.createProjectModalLoading()) return;
    this.selectedProjectId.set(partial.createdProjectId);
    this.createProjectModalOpen.set(false);
    this.createProjectError.set(null);
    this.createProjectPartialState.set(null);
    this.activeNav.set('dashboard');
  }

  protected onEditProjectModalSave(payload: EditProjectModalPayload): void {
    const projectId = this.editProjectTargetId() ?? this.activeProject()?.id;
    if (!projectId || this.editProjectModalLoading()) return;
    void this.updateProject(projectId, payload);
  }

  protected openDeleteProjectDialog(): void {
    const project = this.activeProject();
    if (!project) return;

    this.deleteProjectTargetId.set(project.id);
    this.deleteProjectTargetName.set(project.name);
    this.deleteProjectError.set(null);
    this.deleteProjectDialogOpen.set(true);
  }

  protected closeDeleteProjectDialog(): void {
    if (this.deleteProjectPending()) return;
    this.deleteProjectDialogOpen.set(false);
    this.deleteProjectError.set(null);
  }

  protected confirmDeleteProject(): void {
    const projectId = this.deleteProjectTargetId() ?? this.activeProject()?.id;
    if (!projectId || this.deleteProjectPending()) return;
    void this.deleteProjectRemote(projectId);
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
    if (selectedEndpointId && !this.endpointList().some((endpoint) => endpoint.id === selectedEndpointId)) {
      this.selectedEndpointId.set(null);
    }
    this.selectedLog.set(null);
    this.endpointMutationError.set(null);
    this.closeCreateEndpointWizard(true);
    this.endpointList.set([]);
    this.endpointListState.update((state) => ({ ...state, offset: 0, total: 0, hasMore: false }));
    if (this.activeNav() === 'endpoints') {
      void Promise.all([this.hydrateActiveProjectSummary(project.id), this.reloadEndpointList(project.id)]);
      return;
    }

    void this.hydrateActiveProjectSummary(project.id);
  }

  protected selectNav(id: WorkspaceNavId): void {
    this.activeNav.set(id);
    if (id === 'endpoints') {
      const projectId = this.selectedProjectId() || this.activeProject()?.id;
      if (projectId) {
        void this.reloadEndpointList(projectId);
      }
    }
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

  protected openEndpoints(): void {
    this.activeNav.set('endpoints');
  }

  protected testAllEndpoints(): void {}

  protected exportConfig(): void {
    const project = this.activeProject();
    if (!project || this.endpointMutationPending()) return;
    void this.exportProjectConfiguration(project.id, project.slug);
  }

  protected importEndpoints(): void {
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (!projectId || this.endpointMutationPending()) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void this.importProjectEndpoints(projectId, file);
    };
    input.click();
  }

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

  protected loadMoreProjects(): void {
    if (this.projectsLoading() || this.projectsLoadingMore() || !this.projectsPage().hasMore) return;
    void this.reloadProjects(undefined, true);
  }

  private async reloadProjects(selectProjectId?: string, append = false): Promise<void> {
    if (append) {
      this.projectsLoadingMore.set(true);
      this.projectsLoadMoreError.set(null);
    } else {
      this.projectsLoading.set(true);
      this.projectsError.set(null);
      this.projectsLoadMoreError.set(null);
    }

    try {
      const projects = await this.projectsRepository.listProjects({
        limit: WorkspaceShellComponent.PROJECT_PAGE_LIMIT,
        offset: append ? this.projects().length : 0,
      });

      this.projectsPage.set(projects.page);
      const projectItems = append
        ? [
            ...this.projects(),
            ...projects.items.filter((project) => !this.projects().some((current) => current.id === project.id)),
          ]
        : projects.items;

      this.authSession.markProtectedApiReady();
      this.projects.set(projectItems);

      if (append) {
        return;
      }

      const currentSelected = selectProjectId ?? this.selectedProjectId();
      const nextSelected =
        projectItems.find((project) => project.id === currentSelected)?.id ?? projectItems[0]?.id ?? '';
      this.selectedProjectId.set(nextSelected);

      if (!this.endpointList().some((endpoint) => endpoint.id === this.selectedEndpointId())) {
        this.selectedEndpointId.set(null);
      }

      if (nextSelected) {
        await this.hydrateActiveProjectSummary(nextSelected);
      }
    } catch (error) {
      if (this.authSession.handleProtectedApiError(error)) {
        if (!append) {
          this.projects.set([]);
          this.selectedProjectId.set('');
          this.projectsError.set(null);
        } else {
          this.projectsLoadMoreError.set(null);
        }

        return;
      }

      if (append) {
        this.projectsLoadMoreError.set(error instanceof Error ? error.message : 'Could not load more projects.');
        return;
      }

      this.projects.set([]);
      this.projectsPage.set({ limit: WorkspaceShellComponent.PROJECT_PAGE_LIMIT, offset: 0, total: 0, hasMore: false });
      this.endpointList.set([]);
      this.selectedProjectId.set('');
      this.projectsError.set(error instanceof Error ? error.message : 'Could not load projects.');
    } finally {
      if (append) {
        this.projectsLoadingMore.set(false);
      } else {
        this.projectsLoading.set(false);
      }
    }
  }

  private async refreshProject(projectId: string): Promise<void> {
    try {
      const refreshed = await this.projectsRepository.getProject(projectId);
      this.projects.update((projects) => projects.map((project) => (project.id === projectId ? refreshed : project)));
      await this.reloadEndpointList(projectId);
    } catch (error) {
      this.endpointMutationError.set(error instanceof Error ? error.message : 'Could not refresh project data.');
    }
  }

  private async hydrateActiveProjectSummary(projectId: string): Promise<void> {
    const requestId = ++this.activeSummaryRequestId;

    try {
      const summaryProject = await this.projectsRepository.getProject(projectId);
      this.authSession.markProtectedApiReady();

      if (requestId !== this.activeSummaryRequestId) {
        return;
      }

      this.projects.update((projects) =>
        projects.map((project) => (project.id === projectId ? summaryProject : project)),
      );
    } catch (error) {
      if (requestId !== this.activeSummaryRequestId) {
        return;
      }

      if (this.authSession.handleProtectedApiError(error)) {
        this.projectsError.set(null);
        return;
      }

      this.projectsError.set(error instanceof Error ? error.message : 'Could not load project summary.');
    }
  }

  protected updateEndpointSearch(query: string): void {
    this.endpointListState.update((state) => ({ ...state, q: query }));
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (projectId) void this.reloadEndpointList(projectId);
  }

  protected updateEndpointMethodFilter(method: EndpointListMethodFilter): void {
    this.endpointListState.update((state) => ({ ...state, method }));
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (projectId) void this.reloadEndpointList(projectId);
  }

  protected updateEndpointSort(sort: EndpointsListSortOption): void {
    this.endpointListState.update((state) => ({ ...state, sort }));
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (projectId) void this.reloadEndpointList(projectId);
  }

  protected loadMoreEndpoints(): void {
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (!projectId || this.endpointListLoading() || !this.endpointListState().hasMore) return;
    void this.reloadEndpointList(projectId, true);
  }

  private async reloadEndpointList(projectId: string, append = false): Promise<void> {
    const state = this.endpointListState();
    const offset = append ? this.endpointList().length : 0;

    this.endpointListLoading.set(true);
    this.endpointListError.set(null);

    try {
      const response = await this.endpointsRepository.listEndpoints(projectId, {
        limit: WorkspaceShellComponent.ENDPOINT_PAGE_LIMIT,
        offset,
        q: state.q,
        method: state.method === 'all' ? undefined : state.method,
        sort: state.sort,
      });

      this.endpointList.set(append ? [...this.endpointList(), ...response.items] : response.items);
      this.endpointListState.update(() => ({
        ...state,
        limit: response.page.limit,
        offset: response.page.offset,
        total: response.page.total,
        hasMore: response.page.hasMore,
      }));

      if (!this.endpointList().some((endpoint) => endpoint.id === this.selectedEndpointId())) {
        this.selectedEndpointId.set(null);
      }
    } catch (error) {
      this.endpointListError.set(error instanceof Error ? error.message : 'Could not load endpoints.');
      if (!append) {
        this.endpointList.set([]);
        this.selectedEndpointId.set(null);
      }
    } finally {
      this.endpointListLoading.set(false);
    }
  }

  private async createProject(payload: CreateProjectModalPayload, endpointPrompt?: string): Promise<void> {
    if (this.createProjectModalLoading()) return;
    this.createProjectModalLoading.set(true);
    this.createProjectError.set(null);
    this.createProjectPartialState.set(null);
    try {
      const createdProject = await this.projectsRepository.createProject(payload);
      this.upsertProject(createdProject);
      this.selectedProjectId.set(createdProject.id);
      this.selectedLog.set(null);

      const normalizedPrompt = endpointPrompt?.trim();
      if (normalizedPrompt) {
        await this.generateFirstEndpointForProject(createdProject.id, createdProject.name, normalizedPrompt);
        return;
      }

      await this.reloadProjects(createdProject.id);
      this.createProjectModalOpen.set(false);
      this.closeCreateEndpointWizard(true);
    } catch (error) {
      this.createProjectError.set(error instanceof Error ? error.message : 'Could not create project.');
    } finally {
      this.createProjectModalLoading.set(false);
    }
  }

  private async generateFirstEndpointForProject(
    projectId: string,
    projectName: string,
    endpointPrompt: string,
  ): Promise<void> {
    this.createProjectModalLoading.set(true);
    this.createProjectError.set(null);

    try {
      const endpoint = await this.endpointsRepository.generateAiEndpoint(projectId, endpointPrompt);
      await this.reloadProjects(projectId);
      this.selectedProjectId.set(projectId);
      this.selectedEndpointId.set(endpoint.id);
      this.activeNav.set('endpoints');
      this.createProjectModalOpen.set(false);
      this.createProjectPartialState.set(null);
      this.selectedLog.set(null);
      this.closeCreateEndpointWizard(true);
    } catch (error) {
      this.selectedProjectId.set(projectId);
      await this.reloadProjects(projectId);
      this.createProjectPartialState.set({
        createdProjectId: projectId,
        projectName,
        endpointPrompt,
        message: this.mapCreateProjectGenerationError(error),
        retryable: true,
      });
      this.createProjectModalOpen.set(true);
      this.activeNav.set('dashboard');
      this.createProjectError.set(this.mapCreateProjectGenerationError(error));
    } finally {
      this.createProjectModalLoading.set(false);
    }
  }

  private mapCreateProjectGenerationError(error: unknown): string {
    if (error instanceof ApiError && (error.code === 'AI_UNAVAILABLE' || error.status === 503)) {
      return 'Your project is ready, but AI is unavailable right now. Retry generation or continue manually.';
    }

    if (error instanceof ApiError && (error.code === 'AI_TIMEOUT' || error.status === 504)) {
      return 'Your project is ready, but AI timed out before creating the first endpoint. Retry generation or continue manually.';
    }

    if (error instanceof ApiError && (error.code === 'AI_INVALID_OUTPUT' || error.status === 422)) {
      return 'Your project is ready, but AI returned an invalid first endpoint draft. Retry generation or continue manually.';
    }

    const details = error instanceof Error ? error.message : 'Unknown AI error';
    return `The project was created, but the first endpoint was not created: ${details}`;
  }

  private async updateProject(projectId: string, payload: EditProjectModalPayload): Promise<void> {
    this.editProjectModalLoading.set(true);
    this.editProjectError.set(null);

    try {
      const updatedProject = await this.projectsRepository.updateProject(projectId, payload);
      this.projects.update((projects) =>
        projects.map((project) => (project.id === projectId ? updatedProject : project)),
      );
      this.selectedProjectId.set(projectId);
      this.editProjectModalOpen.set(false);
      this.editProjectTargetId.set(null);
      this.editProjectInitialValues.set(null);
    } catch (error) {
      this.editProjectError.set(error instanceof Error ? error.message : 'Could not update project.');
    } finally {
      this.editProjectModalLoading.set(false);
    }
  }

  private upsertProject(project: DashboardProject): void {
    this.projects.update((projects) => {
      const existingIndex = projects.findIndex((current) => current.id === project.id);
      if (existingIndex === -1) {
        return [...projects, project];
      }

      return projects.map((current) => (current.id === project.id ? project : current));
    });
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

  private async exportProjectConfiguration(projectId: string, projectSlug: string): Promise<void> {
    this.endpointMutationPending.set(true);
    this.endpointMutationError.set(null);

    try {
      const globalConfig = await this.globalConfigRepository.getConfig(projectId);
      const endpoints = await Promise.all(
        this.endpoints().map((endpoint) => this.endpointsRepository.loadDraft(projectId, endpoint.id)),
      );

      const payload: ExportedWorkspaceProjectConfig = {
        version: 1,
        exportedAt: new Date().toISOString(),
        projectId,
        projectSlug,
        globalConfig,
        endpoints,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${projectSlug}-config.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.endpointMutationError.set(error instanceof Error ? error.message : 'Could not export project config.');
    } finally {
      this.endpointMutationPending.set(false);
    }
  }

  private async importProjectEndpoints(projectId: string, file: File): Promise<void> {
    this.endpointMutationPending.set(true);
    this.endpointMutationError.set(null);

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as Partial<ExportedWorkspaceProjectConfig>;

      if (!Array.isArray(parsed.endpoints)) {
        throw new Error('Invalid import file: endpoints array is required.');
      }

      if (parsed.globalConfig) {
        await this.globalConfigRepository.saveConfig(projectId, parsed.globalConfig);
      }

      for (const endpoint of parsed.endpoints) {
        await this.endpointsRepository.saveEndpoint(projectId, endpoint, null);
      }

      await this.refreshProject(projectId);
    } catch (error) {
      this.endpointMutationError.set(error instanceof Error ? error.message : 'Could not import endpoints.');
    } finally {
      this.endpointMutationPending.set(false);
    }
  }

  private async deleteProjectRemote(projectId: string): Promise<void> {
    this.deleteProjectPending.set(true);
    this.deleteProjectError.set(null);

    const nextProjectId = this.projects().find((project) => project.id !== projectId)?.id;

    try {
      await this.projectsRepository.deleteProject(projectId);
      this.clearProjectScopedUiState();
      this.deleteProjectDialogOpen.set(false);
      this.deleteProjectTargetId.set(null);
      this.deleteProjectTargetName.set('');
      if (!nextProjectId) this.activeNav.set('dashboard');
      await this.reloadProjects(nextProjectId);
    } catch (error) {
      this.deleteProjectError.set(error instanceof Error ? error.message : 'Could not delete project.');
    } finally {
      this.deleteProjectPending.set(false);
    }
  }

  private clearProjectScopedUiState(): void {
    this.selectedLog.set(null);
    this.selectedEndpointId.set(null);
    this.endpointMutationError.set(null);
    this.closeCreateEndpointWizard(false);
    this.globalConfigDrawerOpen.set(false);
    this.globalConfigLoading.set(false);
    this.globalConfigSaving.set(false);
    this.globalConfigError.set(null);
    this.globalConfig.set(createDefaultGlobalConfig());
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
      await this.refreshProject(projectId);
      this.globalConfigDrawerOpen.set(false);
    } catch (error) {
      this.globalConfigError.set(error instanceof Error ? error.message : 'Could not save global config.');
    } finally {
      this.globalConfigSaving.set(false);
    }
  }
}
