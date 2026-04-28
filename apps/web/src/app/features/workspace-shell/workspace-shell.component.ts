import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FrontendAuthSessionService } from '../../shared/auth/frontend-auth-session.service';
import { ApiError } from '../../shared/http/api-error.mapper';
import type {
  InvitableWorkspaceRoleDto,
  OpenApiContractAnalyzeDto,
  OpenApiContractOperationDto,
  WorkspaceInvitationDto,
  WorkspaceSummaryDto,
} from '../../shared/http/api.types';
import type { EndpointPreview } from '../../shared/models/endpoint-preview.model';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { CreateProjectModalComponent } from '../../shared/ui/create-project-modal/create-project-modal.component';
import type {
  CreateProjectModalPayload,
  CreateProjectWithEndpointPayload,
  EditProjectModalPayload,
  ProjectModalInitialValues,
  ProjectModalMode,
} from '../../shared/ui/create-project-modal/create-project-modal.model';
import { AccountSectionPageComponent } from '../account/account-section-page.component';
import { AuditHistoryComponent } from '../audit-history/audit-history.component';
import { CreateEndpointPageComponent } from '../endpoints/components/create-endpoint-page/create-endpoint-page.component';
import { EndpointDetailPanelComponent } from '../endpoints/components/endpoint-detail-panel/endpoint-detail-panel.component';
import type {
  EndpointsListMethodFilter,
  EndpointsListSortOption,
} from '../endpoints/components/endpoints-list/endpoints-list.constants';
import { EndpointsRepository } from '../endpoints/data-access/endpoints.repository';
import { EndpointsPageComponent } from '../endpoints/endpoints-page.component';
import type { EndpointFlowMode } from '../endpoints/models/endpoint-draft.model';
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
import { ProjectSnapshotsRepository } from '../project-snapshots/data-access/project-snapshots.repository';
import type {
  ProjectSnapshot,
  ProjectSnapshotRestorePreview,
} from '../project-snapshots/models/project-snapshot.model';
import { WorkspaceMembersRepository } from '../workspace-members/data-access/workspace-members.repository';
import type { WorkspaceMember } from '../workspace-members/models/workspace-member.model';
import { WorkspaceInvitationsRepository } from '../workspace-invitations/data-access/workspace-invitations.repository';
import { WorkspacesRepository } from '../workspaces/data-access/workspaces.repository';
import {
  WorkspaceMembersPageComponent,
  type WorkspacePageWorkspaceSummary,
} from '../workspace-members/workspace-members-page.component';
import { ProjectContractsRepository } from './data-access/project-contracts.repository';
import type {
  CreateProjectAiFlowState,
  EndpointListState,
  PaginationState,
  SidebarProjectPaginationState,
  SidebarProjectRow,
  SnapshotHistoryState,
  WorkspaceNavId,
} from './models/workspace-shell.model';

interface ContractImportReviewState {
  file: File;
  analysis: OpenApiContractAnalyzeDto;
}

interface RestorePreviewDialogState {
  snapshotId: string;
  snapshotName: string;
  preview: ProjectSnapshotRestorePreview;
}

type ContractReviewAction = 'create' | 'update' | 'delete';

const WORKSPACE_NAV_ROUTES = new Set<WorkspaceNavId>([
  'dashboard',
  'endpoints',
  'logs',
  'history',
  'workspace',
  'account-profile-settings',
  'account-usage',
  'account-plan-billing',
]);

const isWorkspaceNavId = (value: string | null): value is WorkspaceNavId =>
  typeof value === 'string' && WORKSPACE_NAV_ROUTES.has(value as WorkspaceNavId);

@Component({
  selector: 'app-workspace-shell',
  standalone: true,
  imports: [
    AuditHistoryComponent,
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
    WorkspaceMembersPageComponent,
    AccountSectionPageComponent,
  ],
  templateUrl: './workspace-shell.component.html',
  styleUrls: ['./workspace-shell.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShellComponent implements OnInit {
  private static readonly PROJECT_PAGE_LIMIT = 25;
  private static readonly ENDPOINT_PAGE_LIMIT = 25;
  private initialized = false;

  private readonly authSession = inject(FrontendAuthSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectsRepository = inject(ProjectsRepository);
  private readonly endpointsRepository = inject(EndpointsRepository);
  private readonly globalConfigRepository = inject(GlobalConfigRepository);
  private readonly projectSnapshotsRepository = inject(ProjectSnapshotsRepository);
  private readonly projectContractsRepository = inject(ProjectContractsRepository);
  private readonly workspaceMembersRepository = inject(WorkspaceMembersRepository);
  private readonly workspaceInvitationsRepository = inject(WorkspaceInvitationsRepository);
  private readonly workspacesRepository = inject(WorkspacesRepository);
  private readonly toast = inject(ToastService);
  private readonly accountNavRoutes = new Set<WorkspaceNavId>([
    'account-profile-settings',
    'account-usage',
    'account-plan-billing',
  ]);

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
  protected readonly isAccountNav = computed(() => this.accountNavRoutes.has(this.activeNav()));
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
  protected readonly canMutateActiveWorkspace = computed(
    () => this.activeProject()?.workspace.capabilities.canEdit ?? false,
  );
  protected readonly canManageActiveWorkspaceMembers = computed(
    () => this.activeProject()?.workspace.capabilities.canManageMembers ?? false,
  );
  protected readonly canRestoreActiveWorkspaceSnapshots = computed(
    () => this.activeProject()?.workspace.capabilities.canRestoreSnapshots ?? false,
  );
  protected readonly canImportActiveWorkspaceContracts = computed(
    () => this.activeProject()?.workspace.capabilities.canImportContracts ?? false,
  );

  protected readonly workspaceMembers = signal<WorkspaceMember[]>([]);
  protected readonly workspaceInvitations = signal<WorkspaceInvitationDto[]>([]);
  protected readonly pendingWorkspaceInvitations = signal<WorkspaceInvitationDto[]>([]);
  protected readonly workspaceMembersLoading = signal(false);
  protected readonly workspaceMembersError = signal<string | null>(null);
  protected readonly workspaceMemberMutationPending = signal(false);

  protected readonly activeWorkspaceSummary = computed((): WorkspacePageWorkspaceSummary | null => {
    const project = this.activeProject();
    if (!project) return null;
    return {
      id: project.workspace.id,
      name: project.workspace.name,
      role: project.workspace.role,
      isPersonal: project.workspace.isPersonal,
      capabilities: project.workspace.capabilities,
    };
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
  protected readonly snapshotHistory = signal<ProjectSnapshot[]>([]);
  protected readonly contractImportReview = signal<ContractImportReviewState | null>(null);
  protected readonly snapshotHistoryState = signal<SnapshotHistoryState>({
    loadedForProjectId: null,
    latestSnapshotId: null,
  });

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
  protected readonly availableWorkspaces = signal<WorkspaceSummaryDto[]>([]);

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
  protected readonly restorePreviewState = signal<RestorePreviewDialogState | null>(null);
  protected readonly restorePreviewPending = signal(false);

  protected readonly createEndpointFlowOpen = signal(false);
  protected readonly endpointWizardMode = signal<EndpointFlowMode>('ai');
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
  protected readonly contractReviewActions: ContractReviewAction[] = ['create', 'update', 'delete'];
  protected readonly restorePreviewDialogOpen = computed(() => this.restorePreviewState() !== null);
  protected readonly restorePreviewActions = ['create', 'update', 'delete', 'keep'] as const;

  constructor() {
    queueMicrotask(() => this.initializeWorkspace());
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.syncNavFromRoute(params.get('navId'));
    });
    this.initializeWorkspace();
  }

  private initializeWorkspace(): void {
    if (this.initialized) return;
    this.initialized = true;
    void this.authSession.bootstrap();
    void this.reloadPendingWorkspaceInvitations();
    void this.reloadProjects();
  }

  protected openSignIn(): void {
    void this.authSession.openSignIn();
  }

  protected signOut(): void {
    void this.authSession.signOut();
  }

  protected openCreateProjectModal(): void {
    if (!this.canMutateActiveWorkspace() && this.hasProjects()) return;
    this.createProjectError.set(null);
    this.createProjectPartialState.set(null);
    this.createProjectModalOpen.set(true);
    void this.loadCreateProjectWorkspaces();
  }

  protected openEditProjectModal(): void {
    if (!this.canMutateActiveWorkspace()) return;
    const project = this.activeProject();
    if (!project) return;

    this.editProjectTargetId.set(project.id);
    this.editProjectInitialValues.set({
      name: project.name,
      description: project.description,
      slug: project.slug,
      workspaceId: project.workspace.id,
    });
    this.editProjectError.set(null);
    this.editProjectModalOpen.set(true);
    void this.loadCreateProjectWorkspaces();
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
    if (!this.canMutateActiveWorkspace() && this.hasProjects()) return;
    this.createProjectModalOpen.set(true);
    void this.createProject(
      {
        name: payload.name,
        description: payload.description,
        workspaceId: payload.workspaceId,
      },
      payload.endpointPrompt,
    );
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
    this.endpointMutationError.set(null);
    void this.navigateToNav('endpoints');
    this.selectedEndpointId.set(null);
    this.endpointWizardInitial.set(null);
    this.endpointWizardMode.set('manual');
    this.createEndpointFlowOpen.set(true);
  }

  protected onEditProjectModalSave(payload: EditProjectModalPayload): void {
    const projectId = this.editProjectTargetId() ?? this.activeProject()?.id;
    if (!projectId || this.editProjectModalLoading()) return;
    void this.updateProject(projectId, payload);
  }

  protected openDeleteProjectDialog(): void {
    if (!this.canMutateActiveWorkspace()) return;
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
    void this.navigateToNav(id);
  }

  private syncNavFromRoute(rawNavId: string | null): void {
    const nextNav: WorkspaceNavId = isWorkspaceNavId(rawNavId) ? rawNavId : 'dashboard';
    if (this.activeNav() === nextNav) return;
    this.activeNav.set(nextNav);
    this.applyNavState(nextNav);
  }

  private applyNavState(id: WorkspaceNavId): void {
    if (id === 'endpoints') {
      const projectId = this.selectedProjectId() || this.activeProject()?.id;
      if (projectId) {
        void this.reloadEndpointList(projectId);
      }
    }
    if (id === 'history') {
      const projectId = this.selectedProjectId() || this.activeProject()?.id;
      if (projectId) {
        void this.loadSnapshotHistory(projectId);
      }
    }
    if (id === 'workspace') {
      const workspaceId = this.activeProject()?.workspace.id;
      if (workspaceId) {
        void this.reloadWorkspaceMembers(workspaceId);
      }
    }
    if (id !== 'endpoints') {
      this.selectedEndpointId.set(null);
      this.createEndpointFlowOpen.set(false);
      this.endpointWizardMode.set('ai');
      this.endpointWizardInitial.set(null);
      this.navBeforeCreateFlow.set(null);
    }
    if (id !== 'logs') {
      this.selectedLog.set(null);
    }
  }

  private async navigateToNav(id: WorkspaceNavId): Promise<void> {
    if (this.route.snapshot.paramMap.get('navId') === id) {
      this.syncNavFromRoute(id);
      return;
    }

    await this.router.navigateByUrl(`/${id}`);
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

  protected createEndpoint(mode: EndpointFlowMode = 'ai'): void {
    if (!this.hasProjects() || !this.canMutateActiveWorkspace()) return;
    this.endpointMutationError.set(null);
    this.navBeforeCreateFlow.set(this.activeNav());
    void this.navigateToNav('endpoints');
    this.selectedEndpointId.set(null);
    this.endpointWizardInitial.set(null);
    this.endpointWizardMode.set(mode);
    this.createEndpointFlowOpen.set(true);
  }

  protected editEndpoint(ep: EndpointPreview): void {
    if (!this.hasProjects() || !this.canMutateActiveWorkspace()) return;
    this.endpointMutationError.set(null);
    this.navBeforeCreateFlow.set(this.activeNav());
    void this.navigateToNav('endpoints');
    this.endpointWizardInitial.set(ep);
    this.endpointWizardMode.set('edit');
    this.createEndpointFlowOpen.set(true);
  }

  protected closeCreateEndpointWizard(restorePreviousNav = false): void {
    this.createEndpointFlowOpen.set(false);
    this.endpointWizardInitial.set(null);
    this.endpointWizardMode.set('ai');
    if (restorePreviousNav) {
      const prev = this.navBeforeCreateFlow();
      if (prev !== null) void this.navigateToNav(prev);
    }
    this.navBeforeCreateFlow.set(null);
  }

  protected onEndpointSaved(ep: EndpointPreview): void {
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (!projectId) return;
    this.selectedEndpointId.set(ep.id);
    void this.navigateToNav('endpoints');
    this.closeCreateEndpointWizard(false);
    void this.refreshProject(projectId);
  }

  protected deleteEndpoint(endpointId: string): void {
    if (!this.canMutateActiveWorkspace()) return;
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (!projectId || this.endpointMutationPending()) return;
    void this.deleteEndpointRemote(projectId, endpointId);
  }

  protected openLogs(): void {
    void this.navigateToNav('logs');
  }

  protected openEndpoints(): void {
    void this.navigateToNav('endpoints');
  }

  protected testAllEndpoints(): void {
    //logica para testear todos los endpoints
  }

  protected async createSnapshot(): Promise<void> {
    if (!this.canMutateActiveWorkspace()) return;
    const project = this.activeProject();
    if (!project || this.endpointMutationPending()) return;
    await this.createProjectSnapshot(project.id, project.name);
  }

  protected exportConfig(): void {
    const project = this.activeProject();
    if (!project || this.endpointMutationPending()) return;
    void this.exportProjectConfiguration(project.id, project.slug);
  }

  protected importEndpoints(): void {
    if (!this.canImportActiveWorkspaceContracts()) return;
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (!projectId || this.endpointMutationPending()) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.yaml,.yml,application/json,application/yaml,text/yaml';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void this.analyzeProjectContractImport(projectId, file);
    };
    input.click();
  }

  protected cancelContractImportReview(): void {
    if (this.endpointMutationPending()) return;
    this.contractImportReview.set(null);
  }

  protected confirmContractImport(): void {
    if (!this.canImportActiveWorkspaceContracts()) return;
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    const review = this.contractImportReview();
    if (!projectId || !review || this.endpointMutationPending()) return;
    void this.commitProjectContractImport(projectId, review.file);
  }

  protected contractReviewActionLabel(action: ContractReviewAction): string {
    switch (action) {
      case 'create':
        return 'Create';
      case 'update':
        return 'Update';
      case 'delete':
        return 'Delete';
    }
  }

  protected contractReviewOperationsForAction(
    operations: OpenApiContractOperationDto[],
    action: ContractReviewAction,
  ): OpenApiContractOperationDto[] {
    return operations.filter((operation) => operation.action === action);
  }

  protected editGlobalConfig(): void {
    if (!this.canMutateActiveWorkspace()) return;
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
    if (!this.canMutateActiveWorkspace()) return;
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (!projectId || this.globalConfigSaving()) return;
    this.globalConfigSaving.set(true);
    this.globalConfigError.set(null);
    void this.saveGlobalConfig(projectId, cfg);
  }

  protected addWorkspaceMember(input: { email: string; role: InvitableWorkspaceRoleDto }): void {
    const workspaceId = this.activeProject()?.workspace.id;
    if (!workspaceId || !this.canManageActiveWorkspaceMembers() || this.workspaceMemberMutationPending()) return;
    void this.addWorkspaceMemberRemote(workspaceId, input);
  }

  protected acceptWorkspaceInvitation(invitationId: string): void {
    if (this.workspaceMemberMutationPending()) return;
    void this.acceptWorkspaceInvitationRemote(invitationId);
  }

  protected revokeWorkspaceInvitation(invitationId: string): void {
    const workspaceId = this.activeProject()?.workspace.id;
    if (!workspaceId || !this.canManageActiveWorkspaceMembers() || this.workspaceMemberMutationPending()) return;
    void this.revokeWorkspaceInvitationRemote(workspaceId, invitationId);
  }

  protected updateWorkspaceMemberRole(input: { memberUserId: string; role: 'owner' | 'editor' | 'viewer' }): void {
    const activeProject = this.activeProject();
    const workspaceId = activeProject?.workspace.id;
    if (
      !workspaceId ||
      !activeProject ||
      !this.canManageActiveWorkspaceMembers() ||
      this.workspaceMemberMutationPending()
    ) {
      return;
    }

    void this.updateWorkspaceMemberRoleRemote(workspaceId, input);
  }

  protected removeWorkspaceMember(memberUserId: string): void {
    const workspaceId = this.activeProject()?.workspace.id;
    if (!workspaceId || !this.canManageActiveWorkspaceMembers() || this.workspaceMemberMutationPending()) return;
    void this.removeWorkspaceMemberRemote(workspaceId, memberUserId);
  }

  protected retryLoadProjects(): void {
    void this.reloadProjects();
  }

  protected loadMoreProjects(): void {
    if (this.projectsLoading() || this.projectsLoadingMore() || !this.projectsPage().hasMore) return;
    void this.reloadProjects(undefined, true);
  }

  private async reloadProjects(selectProjectId?: string, append = false): Promise<void> {
    this.setProjectsLoadingState(append);

    try {
      const projects = await this.projectsRepository.listProjects({
        limit: WorkspaceShellComponent.PROJECT_PAGE_LIMIT,
        offset: append ? this.projects().length : 0,
      });
      const projectItems = this.resolveReloadedProjects(projects.items, append);

      this.projectsPage.set(projects.page);
      this.authSession.markProtectedApiReady();
      this.projects.set(projectItems);
      await this.reloadPendingWorkspaceInvitations();

      if (append) {
        return;
      }

      await this.syncSelectedProjectAfterReload(projectItems, selectProjectId);
    } catch (error) {
      if (this.handleReloadProjectsAuthError(error, append)) {
        return;
      }

      this.handleReloadProjectsFailure(error, append);
    } finally {
      this.setProjectsLoadingComplete(append);
    }
  }

  private setProjectsLoadingState(append: boolean): void {
    if (append) {
      this.projectsLoadingMore.set(true);
      this.projectsLoadMoreError.set(null);
      return;
    }

    this.projectsLoading.set(true);
    this.projectsError.set(null);
    this.projectsLoadMoreError.set(null);
  }

  private setProjectsLoadingComplete(append: boolean): void {
    if (append) {
      this.projectsLoadingMore.set(false);
      return;
    }

    this.projectsLoading.set(false);
  }

  private resolveReloadedProjects(items: DashboardProject[], append: boolean): DashboardProject[] {
    if (!append) {
      return items;
    }

    const currentProjects = this.projects();
    const currentIds = new Set(currentProjects.map((project) => project.id));
    return [...currentProjects, ...items.filter((project) => !currentIds.has(project.id))];
  }

  private async syncSelectedProjectAfterReload(
    projectItems: DashboardProject[],
    selectProjectId?: string,
  ): Promise<void> {
    const currentSelected = selectProjectId ?? this.selectedProjectId();
    const nextSelected =
      projectItems.find((project) => project.id === currentSelected)?.id ?? projectItems[0]?.id ?? '';
    this.selectedProjectId.set(nextSelected);

    if (!nextSelected) {
      this.workspaceMembers.set([]);
      this.workspaceInvitations.set([]);
      this.workspaceMembersError.set(null);
    }

    if (!this.endpointList().some((endpoint) => endpoint.id === this.selectedEndpointId())) {
      this.selectedEndpointId.set(null);
    }

    if (nextSelected) {
      await this.hydrateActiveProjectSummary(nextSelected);
      if (this.activeNav() === 'endpoints') {
        await this.reloadEndpointList(nextSelected);
      }
      if (this.activeNav() === 'history') {
        await this.loadSnapshotHistory(nextSelected);
      }
    }
  }

  private handleReloadProjectsAuthError(error: unknown, append: boolean): boolean {
    if (!this.authSession.handleProtectedApiError(error)) {
      return false;
    }

    if (append) {
      this.projectsLoadMoreError.set(null);
      return true;
    }

    this.projects.set([]);
    this.selectedProjectId.set('');
    this.projectsError.set(null);
    return true;
  }

  private handleReloadProjectsFailure(error: unknown, append: boolean): void {
    if (append) {
      this.projectsLoadMoreError.set(error instanceof Error ? error.message : 'Could not load more projects.');
      return;
    }

    this.projects.set([]);
    this.projectsPage.set({ limit: WorkspaceShellComponent.PROJECT_PAGE_LIMIT, offset: 0, total: 0, hasMore: false });
    this.endpointList.set([]);
    this.workspaceMembers.set([]);
    this.workspaceInvitations.set([]);
    this.pendingWorkspaceInvitations.set([]);
    this.workspaceMembersError.set(null);
    this.contractImportReview.set(null);
    this.selectedProjectId.set('');
    this.projectsError.set(error instanceof Error ? error.message : 'Could not load projects.');
  }

  private async refreshProject(projectId: string): Promise<void> {
    try {
      const refreshed = await this.projectsRepository.getProject(projectId);
      this.projects.update((projects) => projects.map((project) => (project.id === projectId ? refreshed : project)));
      await this.reloadWorkspaceMembers(refreshed.workspace.id, { silent: true });
      await this.reloadPendingWorkspaceInvitations();
      if (this.activeNav() === 'history') {
        await this.loadSnapshotHistory(projectId, true);
      }
      await this.reloadEndpointList(projectId);
      this.contractImportReview.set(null);
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
      await this.reloadWorkspaceMembers(summaryProject.workspace.id);
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

  protected updateEndpointMethodFilter(method: EndpointsListMethodFilter): void {
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
      await this.reloadEndpointList(projectId);
      this.selectedProjectId.set(projectId);
      await this.navigateToNav('endpoints');
      this.selectedEndpointId.set(endpoint.id);
      this.createProjectModalOpen.set(false);
      this.createProjectPartialState.set(null);
      this.selectedLog.set(null);
      this.closeCreateEndpointWizard(true);
    } catch (error) {
      this.selectedProjectId.set(projectId);
      await this.reloadProjects(projectId);
      const errorMessage = this.mapCreateProjectGenerationError(error);
      this.createProjectPartialState.set({
        createdProjectId: projectId,
        projectName,
        endpointPrompt,
        message: errorMessage,
        retryable: true,
      });
      this.createProjectModalOpen.set(true);
      this.createProjectError.set(errorMessage);
      await this.navigateToNav('dashboard');
    } finally {
      this.createProjectModalLoading.set(false);
    }
  }

  private async loadCreateProjectWorkspaces(): Promise<void> {
    try {
      const workspaces = await this.workspacesRepository.listWorkspaces();
      const activeWorkspaceId = this.activeProject()?.workspace.id;
      const preferredWorkspace =
        workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
        workspaces.find((workspace) => workspace.isPersonal) ??
        workspaces[0];

      if (!preferredWorkspace) {
        this.availableWorkspaces.set([]);
        return;
      }

      this.availableWorkspaces.set([
        preferredWorkspace,
        ...workspaces.filter((workspace) => workspace.id !== preferredWorkspace.id),
      ]);
    } catch (error) {
      this.availableWorkspaces.set([]);
      this.createProjectError.set(error instanceof Error ? error.message : 'Could not load workspaces.');
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
    const previousProject = this.projects().find((project) => project.id === projectId) ?? null;

    try {
      const updatedProject = await this.projectsRepository.updateProject(projectId, payload);
      this.projects.update((projects) =>
        projects.map((project) => (project.id === projectId ? updatedProject : project)),
      );
      this.selectedProjectId.set(projectId);

      if (previousProject && previousProject.workspace.id !== updatedProject.workspace.id) {
        this.workspaceMembers.set([]);
        this.workspaceMembersError.set(null);

        if (this.activeNav() === 'workspace') {
          await this.reloadWorkspaceMembers(updatedProject.workspace.id);
        }
      }

      this.editProjectModalOpen.set(false);
      this.editProjectTargetId.set(null);
      this.editProjectInitialValues.set(null);
    } catch (error) {
      this.editProjectError.set(this.mapEditProjectError(error));
    } finally {
      this.editProjectModalLoading.set(false);
    }
  }

  private mapEditProjectError(error: unknown): string {
    if (error instanceof ApiError && error.code === 'PROJECT_SLUG_DUPLICATE') {
      return 'This mock route slug is already in use. Try a different slug.';
    }

    if (error instanceof ApiError && error.code === 'PROJECT_SLUG_RESERVED') {
      return 'This slug is reserved by the platform. Choose another one.';
    }

    return error instanceof Error ? error.message : 'Could not update project.';
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
      const payload = await this.projectContractsRepository.exportContract(projectId, 'json');
      const blob = new Blob([payload.text], { type: payload.contentType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = payload.filename || `${projectSlug}-openapi.json`;
      anchor.click();
      URL.revokeObjectURL(url);

      if (payload.warnings.length > 0) {
        this.endpointMutationError.set(
          `Contract exported with ${payload.warnings.length} warning${payload.warnings.length === 1 ? '' : 's'}.`,
        );
      }
    } catch (error) {
      this.endpointMutationError.set(error instanceof Error ? error.message : 'Could not export project contract.');
    } finally {
      this.endpointMutationPending.set(false);
    }
  }

  private async analyzeProjectContractImport(projectId: string, file: File): Promise<void> {
    this.endpointMutationPending.set(true);
    this.endpointMutationError.set(null);
    this.contractImportReview.set(null);

    try {
      const analysis = await this.projectContractsRepository.analyzeContract(projectId, file);
      this.contractImportReview.set({ file, analysis });
    } catch (error) {
      this.endpointMutationError.set(error instanceof Error ? error.message : 'Could not analyze project contract.');
    } finally {
      this.endpointMutationPending.set(false);
    }
  }

  private async commitProjectContractImport(projectId: string, file: File): Promise<void> {
    this.endpointMutationPending.set(true);
    this.endpointMutationError.set(null);

    try {
      await this.projectContractsRepository.importContract(projectId, file);
      this.contractImportReview.set(null);
      await this.refreshProject(projectId);
    } catch (error) {
      this.endpointMutationError.set(error instanceof Error ? error.message : 'Could not import project contract.');
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
      if (!nextProjectId) void this.navigateToNav('dashboard');
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
    this.workspaceMembers.set([]);
    this.workspaceMembersLoading.set(false);
    this.workspaceMembersError.set(null);
    this.workspaceMemberMutationPending.set(false);
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

  private async reloadWorkspaceMembers(workspaceId: string, options?: { silent?: boolean }): Promise<void> {
    const silent = options?.silent ?? false;
    if (!silent) {
      this.workspaceMembersLoading.set(true);
    }
    this.workspaceMembersError.set(null);

    try {
      const members = await this.workspaceMembersRepository.listMembers(workspaceId);
      this.workspaceMembers.set(members);
      await this.reloadWorkspaceInvitations(workspaceId);
    } catch (error) {
      this.workspaceMembers.set([]);
      this.workspaceInvitations.set([]);
      this.workspaceMembersError.set(error instanceof Error ? error.message : 'Could not load workspace members.');
    } finally {
      if (!silent) {
        this.workspaceMembersLoading.set(false);
      }
    }
  }

  private async reloadWorkspaceInvitations(workspaceId: string): Promise<void> {
    if (!this.canManageActiveWorkspaceMembers()) {
      this.workspaceInvitations.set([]);
      return;
    }

    try {
      const invitations = await this.workspaceInvitationsRepository.listWorkspaceInvitations(workspaceId);
      this.workspaceInvitations.set(invitations.filter((invitation) => invitation.status === 'pending'));
    } catch (error) {
      this.workspaceInvitations.set([]);
      this.workspaceMembersError.set(error instanceof Error ? error.message : 'Could not load workspace invitations.');
    }
  }

  private async reloadPendingWorkspaceInvitations(): Promise<void> {
    try {
      const invitations = await this.workspaceInvitationsRepository.listPendingInvitations();
      this.pendingWorkspaceInvitations.set(invitations);
    } catch (error) {
      this.pendingWorkspaceInvitations.set([]);
      if (this.authSession.handleProtectedApiError(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Could not load pending workspace invitations.';
      this.toast.error(message);
    }
  }

  private async addWorkspaceMemberRemote(
    workspaceId: string,
    input: { email: string; role: InvitableWorkspaceRoleDto },
  ): Promise<void> {
    this.workspaceMemberMutationPending.set(true);
    this.workspaceMembersError.set(null);

    try {
      await this.workspaceInvitationsRepository.createInvitation(workspaceId, input);
      await this.reloadWorkspaceInvitations(workspaceId);
      await this.reloadPendingWorkspaceInvitations();
    } catch (error) {
      this.workspaceMembersError.set(error instanceof Error ? error.message : 'Could not send workspace invitation.');
    } finally {
      this.workspaceMemberMutationPending.set(false);
    }
  }

  private async revokeWorkspaceInvitationRemote(workspaceId: string, invitationId: string): Promise<void> {
    this.workspaceMemberMutationPending.set(true);
    this.workspaceMembersError.set(null);

    try {
      await this.workspaceInvitationsRepository.revokeInvitation(workspaceId, invitationId);
      await this.reloadWorkspaceInvitations(workspaceId);
      await this.reloadPendingWorkspaceInvitations();
    } catch (error) {
      this.workspaceMembersError.set(error instanceof Error ? error.message : 'Could not revoke workspace invitation.');
    } finally {
      this.workspaceMemberMutationPending.set(false);
    }
  }

  private async acceptWorkspaceInvitationRemote(invitationId: string): Promise<void> {
    this.workspaceMemberMutationPending.set(true);

    try {
      await this.workspaceInvitationsRepository.acceptInvitation(invitationId);
      await this.reloadPendingWorkspaceInvitations();
      await this.reloadProjects();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not accept workspace invitation.';
      this.toast.error(message);
    } finally {
      this.workspaceMemberMutationPending.set(false);
    }
  }

  private async updateWorkspaceMemberRoleRemote(
    workspaceId: string,
    input: { memberUserId: string; role: 'owner' | 'editor' | 'viewer' },
  ): Promise<void> {
    this.workspaceMemberMutationPending.set(true);
    this.workspaceMembersError.set(null);

    try {
      const updated = await this.workspaceMembersRepository.updateMemberRole(workspaceId, input.memberUserId, {
        role: input.role,
      });
      this.workspaceMembers.update((members) =>
        members.map((member) => (member.userId === updated.userId ? updated : member)),
      );
    } catch (error) {
      this.workspaceMembersError.set(
        error instanceof Error ? error.message : 'Could not update workspace member role.',
      );
    } finally {
      this.workspaceMemberMutationPending.set(false);
    }
  }

  private async removeWorkspaceMemberRemote(workspaceId: string, memberUserId: string): Promise<void> {
    this.workspaceMemberMutationPending.set(true);
    this.workspaceMembersError.set(null);

    try {
      await this.workspaceMembersRepository.removeMember(workspaceId, memberUserId);
      await this.reloadWorkspaceMembers(workspaceId);
    } catch (error) {
      this.workspaceMembersError.set(error instanceof Error ? error.message : 'Could not remove workspace member.');
    } finally {
      this.workspaceMemberMutationPending.set(false);
    }
  }

  protected restorePreviewEntries(action: (typeof this.restorePreviewActions)[number]) {
    return this.restorePreviewState()?.preview.endpoints[action] ?? [];
  }

  protected closeRestorePreview(): void {
    if (this.endpointMutationPending()) return;
    this.restorePreviewState.set(null);
  }

  protected async confirmRestoreSnapshot(): Promise<void> {
    if (!this.canRestoreActiveWorkspaceSnapshots()) return;
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    const previewState = this.restorePreviewState();
    if (!projectId || !previewState || this.endpointMutationPending()) return;

    this.endpointMutationPending.set(true);
    this.endpointMutationError.set(null);

    try {
      await this.projectSnapshotsRepository.restore(projectId, previewState.snapshotId);
      await this.refreshProject(projectId);
      await this.loadSnapshotHistory(projectId, true);
      this.restorePreviewState.set(null);
    } catch (error) {
      this.endpointMutationError.set(error instanceof Error ? error.message : 'Could not restore snapshot.');
    } finally {
      this.endpointMutationPending.set(false);
    }
  }

  protected async restoreSnapshot(snapshotId: string): Promise<void> {
    if (!this.canRestoreActiveWorkspaceSnapshots()) return;
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (!projectId || this.endpointMutationPending() || this.restorePreviewPending()) return;

    this.restorePreviewPending.set(true);
    this.endpointMutationError.set(null);

    try {
      const preview = await this.projectSnapshotsRepository.previewRestore(projectId, snapshotId);
      this.restorePreviewState.set({
        snapshotId,
        snapshotName: preview.snapshotName,
        preview,
      });
    } catch (error) {
      this.endpointMutationError.set(error instanceof Error ? error.message : 'Could not restore snapshot.');
    } finally {
      this.restorePreviewPending.set(false);
    }
  }

  private async createProjectSnapshot(projectId: string, projectName: string): Promise<void> {
    this.endpointMutationPending.set(true);
    this.endpointMutationError.set(null);

    try {
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      await this.projectSnapshotsRepository.create(projectId, {
        name: `${projectName} @ ${timestamp}`,
      });
      await this.loadSnapshotHistory(projectId, true);
      await this.refreshProject(projectId);
    } catch (error) {
      this.endpointMutationError.set(error instanceof Error ? error.message : 'Could not create snapshot.');
    } finally {
      this.endpointMutationPending.set(false);
    }
  }

  private async loadSnapshotHistory(projectId: string, force = false): Promise<void> {
    if (!force && this.snapshotHistoryState().loadedForProjectId === projectId) return;

    try {
      const response = await this.projectSnapshotsRepository.list(projectId);
      this.snapshotHistory.set(response.items);
      this.snapshotHistoryState.set({
        loadedForProjectId: projectId,
        latestSnapshotId: response.items[0]?.id ?? null,
      });
    } catch (error) {
      this.endpointMutationError.set(error instanceof Error ? error.message : 'Could not load snapshot history.');
    }
  }
}
