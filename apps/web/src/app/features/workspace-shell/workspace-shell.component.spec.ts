import { Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, map } from 'rxjs';
import { setupAngularVitest } from '../../testing/angular-vitest';
import { FrontendAuthSessionService } from '../../shared/auth/frontend-auth-session.service';
import { ApiError } from '../../shared/http/api-error.mapper';
import type { WorkspaceSummaryDto } from '../../shared/http/api.types';
import { EndpointsRepository } from '../endpoints/data-access/endpoints.repository';
import { GlobalConfigRepository } from '../global-config/data-access/global-config.repository';
import type { GlobalConfig } from '../global-config/models/global-config.model';
import { ProjectsRepository } from '../main-dashboard/data-access/projects.repository';
import { ProjectSnapshotsRepository } from '../project-snapshots/data-access/project-snapshots.repository';
import { ProjectContractsRepository } from './data-access/project-contracts.repository';
import type { DashboardProject } from '../main-dashboard/models/dashboard-project.model';
import type { EndpointPreview } from '../../shared/models/endpoint-preview.model';
import { WorkspaceMembersRepository } from '../workspace-members/data-access/workspace-members.repository';
import { WorkspacesRepository } from '../workspaces/data-access/workspaces.repository';
import type { WorkspaceMember } from '../workspace-members/models/workspace-member.model';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { WorkspaceInvitationsRepository } from '../workspace-invitations/data-access/workspace-invitations.repository';
import type {
  CreateProjectWithEndpointPayload,
  EditProjectModalPayload,
  ProjectModalInitialValues,
} from '../../shared/ui/create-project-modal/create-project-modal.model';
import type { ApiLogEntry } from '../logs/models/api-log.model';
import type { CreateProjectAiFlowState } from './models/workspace-shell.model';
import { WorkspaceShellComponent } from './workspace-shell.component';
import { signal } from '@angular/core';
import type { EndpointFlowMode } from '../endpoints/models/endpoint-draft.model';

setupAngularVitest();

function createWorkspaceRouterTestDoubles(initialNavId = 'dashboard') {
  const navId$ = new BehaviorSubject(initialNavId);
  const route = {
    paramMap: navId$.pipe(map((navId) => convertToParamMap({ navId }))),
    snapshot: {
      paramMap: {
        get: (key: string) => (key === 'navId' ? navId$.getValue() : null),
      },
    },
  };
  const router = {
    navigateByUrl: vi.fn(async (url: string) => {
      const navId = url.replace(/^\//, '');
      navId$.next(navId || 'dashboard');
      return true;
    }),
  };

  return { route, router };
}

type WritableSignalLike<T> = {
  (): T;
  set(value: T): void;
};

type WorkspaceShellTestApi = {
  projects: WritableSignalLike<DashboardProject[]>;
  projectsPage: WritableSignalLike<{ limit: number; offset: number; total: number; hasMore: boolean }>;
  activeProject: () => DashboardProject | null;
  projectsError: () => string | null;
  projectsLoadingMore: () => boolean;
  projectsLoadMoreError: () => string | null;
  projectsLoading: () => boolean;
  selectedProjectId: WritableSignalLike<string>;
  selectedEndpointId: WritableSignalLike<string | null>;
  selectedLog: WritableSignalLike<ApiLogEntry | null>;
  activeNav: WritableSignalLike<'dashboard' | 'logs' | 'endpoints' | 'history' | 'workspace'>;
  globalConfig: WritableSignalLike<GlobalConfig>;
  globalConfigDrawerOpen: WritableSignalLike<boolean>;
  globalConfigError: () => string | null;
  globalConfigLoading: () => boolean;
  globalConfigSaving: () => boolean;
  createEndpointFlowOpen: WritableSignalLike<boolean>;
  endpointWizardMode: WritableSignalLike<EndpointFlowMode>;
  createProjectModalOpen: WritableSignalLike<boolean>;
  createProjectModalLoading: () => boolean;
  createProjectError: () => string | null;
  createProjectPartialState: WritableSignalLike<CreateProjectAiFlowState | null>;
  contractImportReview: WritableSignalLike<unknown | null>;
  editProjectModalOpen: WritableSignalLike<boolean>;
  editProjectModalLoading: () => boolean;
  editProjectError: () => string | null;
  availableWorkspaces: WritableSignalLike<WorkspaceSummaryDto[]>;
  editProjectInitialValues: WritableSignalLike<(ProjectModalInitialValues & { workspaceId?: string }) | null>;
  deleteProjectDialogOpen: WritableSignalLike<boolean>;
  deleteProjectPending: () => boolean;
  deleteProjectError: () => string | null;
  restorePreviewDialogOpen: () => boolean;
  restorePreviewPending: () => boolean;
  restorePreviewState: () => { snapshotId: string; snapshotName: string } | null;
  retryLoadProjects(): void;
  loadMoreProjects(): void;
  selectProject(id: string): void;
  selectNav(id: 'dashboard' | 'logs' | 'endpoints' | 'history' | 'workspace'): void;
  activeWorkspaceSummary: () => {
    id: string;
    name: string;
    role: 'owner' | 'editor' | 'viewer';
    isPersonal?: boolean;
    capabilities: {
      canEdit: boolean;
      canManageMembers: boolean;
      canRestoreSnapshots: boolean;
      canImportContracts: boolean;
    };
  } | null;
  pendingWorkspaceInvitations: () => Array<{
    id: string;
    workspaceId: string;
    workspaceName: string;
    email: string;
    role: 'owner' | 'editor' | 'viewer';
    status: 'pending' | 'accepted' | 'revoked';
    createdAt: string;
  }>;
  editGlobalConfig(): void;
  openEditProjectModal(): void;
  onEditProjectModalSave(payload: EditProjectModalPayload): void;
  openDeleteProjectDialog(): void;
  closeDeleteProjectDialog(): void;
  confirmDeleteProject(): void;
  createEndpoint(mode?: EndpointFlowMode): void;
  editEndpoint(ep: EndpointPreview): void;
  onGlobalConfigSaved(config: GlobalConfig): void;
  addWorkspaceMember(input: { email: string; role: 'owner' | 'editor' | 'viewer' }): void;
  acceptWorkspaceInvitation(invitationId: string): void;
  revokeWorkspaceInvitation(invitationId: string): void;
  updateWorkspaceMemberRole(input: { memberUserId: string; role: 'owner' | 'editor' | 'viewer' }): void;
  removeWorkspaceMember(memberUserId: string): void;
  onCreateProjectModalWithEndpoint(payload: CreateProjectWithEndpointPayload): void;
  retryCreateProjectEndpointGeneration(): void;
  continueCreateProjectManually(): void;
  restoreSnapshot(snapshotId: string): Promise<void>;
  confirmRestoreSnapshot(): Promise<void>;
  closeRestorePreview(): void;
  confirmContractImport(): void;
  cancelContractImportReview(): void;
};

function flushAsyncWork(cycles = 4): Promise<void> {
  return Array.from({ length: cycles }).reduce<Promise<void>>(
    (chain) => chain.then(async () => Promise.resolve()),
    Promise.resolve(),
  );
}

const endpointFixture: EndpointPreview = {
  id: 'ep-1',
  method: 'GET',
  path: '/users',
  description: 'List users',
  latencyMs: 120,
  statusCode: 200,
  responseBody: [{ id: 1 }],
  responseHeaders: { 'content-type': 'application/json' },
  config: {
    latencyMs: 120,
    errorRatePct: 0,
    scenarios: {
      success: true,
      empty: false,
      error: false,
      timeout: false,
      unauthorized: false,
    },
  },
};

const emptyDashboardState = {
  metrics: {
    totalEndpoints: 0,
    totalScenarios: 0,
    avgLatencyMs: 0,
    errorRatePct: 0,
    totalRequests: 0,
  },
  health: {
    readyEndpoints: 0,
    needsAttentionEndpoints: 0,
    errorScenarioEndpoints: 0,
    emptyScenarioEndpoints: 0,
    timeoutScenarioEndpoints: 0,
  },
  endpointRows: [],
  endpointRowsMeta: {
    total: 0,
    limit: 0,
    hasMore: false,
  },
  recentRequests: [],
  configSummary: {
    latency: { enabled: false, mode: 'fixed' as const, minMs: 0, maxMs: 1000 },
    errorSimulation: { enabled: false, ratePct: 0, codes: [500] },
    rateLimiting: { enabled: false, rpm: 60 },
    logging: { level: 'basic' as const },
    scope: 'all' as const,
  },
};

const projectFixture: DashboardProject = {
  id: 'project-1',
  name: 'Workspace project',
  slug: 'project-1',
  workspace: {
    id: 'workspace-1',
    name: 'Personal workspace',
    kind: 'personal',
    role: 'owner',
    capabilities: {
      canEdit: true,
      canManageMembers: true,
      canRestoreSnapshots: true,
      canImportContracts: true,
    },
  },
  status: 'running',
  mockUrl: 'https://mock.example.com/project-1',
  description: 'Live backend project',
  lastUpdatedRelative: 'just now',
  ...emptyDashboardState,
  endpoints: [endpointFixture],
};

const secondProjectFixture: DashboardProject = {
  id: 'project-2',
  name: 'Billing API',
  slug: 'project-2',
  workspace: {
    id: 'workspace-2',
    name: 'Equipo Plataforma',
    kind: 'team',
    role: 'editor',
    capabilities: {
      canEdit: true,
      canManageMembers: false,
      canRestoreSnapshots: false,
      canImportContracts: false,
    },
  },
  status: 'empty',
  mockUrl: 'https://mock.example.com/project-2',
  description: 'Second project',
  lastUpdatedRelative: '1 minute ago',
  ...emptyDashboardState,
  endpoints: [],
};

const logFixture: ApiLogEntry = {
  id: 'log-1',
  method: 'GET',
  path: '/users',
  fullUrl: 'https://mock.example.com/project-1/users',
  origin: 'mock',
  statusCode: 200,
  latencyMs: 84,
  scenario: 'success',
  scenarioSelectionSource: 'weighted-random',
  scenarioName: 'success-case',
  hasScenario: true,
  createdAt: '2026-04-08T10:00:00.000Z',
  requestHeaders: {},
  requestBody: null,
  responseHeaders: {},
  responseBody: { ok: true },
  timeLabel: 'just now',
};

const normalizedConfigFixture: GlobalConfig = {
  latency: { enabled: true, minMs: 120, maxMs: 800, mode: 'random' },
  errorSimulation: { enabled: true, rate: 15, statusCodes: [400, 500] },
  rateLimiting: { enabled: false, requestsPerMinute: 100 },
  logging: { level: 'none' },
  scope: 'all',
};

function pagedProjectsResult(items: DashboardProject[]) {
  return {
    items,
    page: { limit: 25, offset: 0, total: items.length, hasMore: false },
  };
}

describe('WorkspaceShellComponent', () => {
  const projectsRepository = {
    listProjects: vi.fn(),
    createProject: vi.fn(),
    getProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
  };

  const endpointsRepository = {
    saveEndpoint: vi.fn(),
    generateAiEndpoint: vi.fn(),
    deleteEndpoint: vi.fn(),
  };

  const globalConfigRepository = {
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
  };

  const workspaceMembersRepository = {
    listMembers: vi.fn(),
    addMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
  };

  const workspacesRepository = {
    listWorkspaces: vi.fn(),
  };

  const workspaceInvitationsRepository = {
    listWorkspaceInvitations: vi.fn(),
    createInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
    listPendingInvitations: vi.fn(),
    acceptInvitation: vi.fn(),
  };

  const projectSnapshotsRepository = {
    list: vi.fn(),
    get: vi.fn(),
    previewRestore: vi.fn(),
    create: vi.fn(),
    restore: vi.fn(),
  };

  const projectContractsRepository = {
    exportContract: vi.fn(),
    analyzeContract: vi.fn(),
    importContract: vi.fn(),
  };

  const authSession = {
    snapshot: signal({
      state: 'authenticated',
      userId: 'user-1',
      displayName: 'Owner User',
      username: 'owner.user',
      email: 'owner@example.com',
      emailVerified: true,
      headers: {
        authStatus: 'signed-in' as const,
        userId: 'user-1',
        email: 'owner@example.com',
        emailVerified: true,
        displayName: 'Owner User',
      },
      reason: null,
    }),
    accessState: signal<'ready' | 'unauthenticated' | 'unauthorized'>('ready'),
    bootstrap: vi.fn(async () => undefined),
    openSignIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    markProtectedApiReady: vi.fn(),
    handleProtectedApiError: vi.fn(() => false),
    canAccessProtectedRoutes: vi.fn(() => true),
  };

  function createComponent() {
    const { route, router } = createWorkspaceRouterTestDoubles();
    const injector = Injector.create({
      providers: [
        { provide: ProjectsRepository, useValue: projectsRepository },
        { provide: EndpointsRepository, useValue: endpointsRepository },
        { provide: GlobalConfigRepository, useValue: globalConfigRepository },
        { provide: ProjectSnapshotsRepository, useValue: projectSnapshotsRepository },
        { provide: ProjectContractsRepository, useValue: projectContractsRepository },
        { provide: WorkspaceMembersRepository, useValue: workspaceMembersRepository },
        { provide: WorkspacesRepository, useValue: workspacesRepository },
        { provide: WorkspaceInvitationsRepository, useValue: workspaceInvitationsRepository },
        { provide: FrontendAuthSessionService, useValue: authSession },
        { provide: ActivatedRoute, useValue: route },
        { provide: Router, useValue: router },
        ToastService,
      ],
    });

    const component = runInInjectionContext(
      injector,
      () => new WorkspaceShellComponent(),
    ) as unknown as WorkspaceShellTestApi;
    (component as unknown as { ngOnInit(): void }).ngOnInit();
    return component;
  }

  beforeEach(() => {
    projectsRepository.listProjects.mockReset();
    projectsRepository.createProject.mockReset();
    projectsRepository.getProject.mockReset();
    projectsRepository.updateProject.mockReset();
    projectsRepository.deleteProject.mockReset();
    endpointsRepository.saveEndpoint.mockReset();
    endpointsRepository.generateAiEndpoint.mockReset();
    endpointsRepository.deleteEndpoint.mockReset();
    globalConfigRepository.getConfig.mockReset();
    globalConfigRepository.saveConfig.mockReset();
    projectSnapshotsRepository.list.mockReset();
    projectSnapshotsRepository.get.mockReset();
    projectSnapshotsRepository.previewRestore.mockReset();
    projectSnapshotsRepository.create.mockReset();
    projectSnapshotsRepository.restore.mockReset();
    projectContractsRepository.exportContract.mockReset();
    projectContractsRepository.analyzeContract.mockReset();
    projectContractsRepository.importContract.mockReset();
    workspaceMembersRepository.listMembers.mockReset();
    workspacesRepository.listWorkspaces.mockReset();
    workspaceMembersRepository.addMember.mockReset();
    workspaceMembersRepository.updateMemberRole.mockReset();
    workspaceMembersRepository.removeMember.mockReset();
    workspaceInvitationsRepository.listWorkspaceInvitations.mockReset();
    workspaceInvitationsRepository.createInvitation.mockReset();
    workspaceInvitationsRepository.revokeInvitation.mockReset();
    workspaceInvitationsRepository.listPendingInvitations.mockReset();
    workspaceInvitationsRepository.acceptInvitation.mockReset();
    authSession.bootstrap.mockReset();
    authSession.openSignIn.mockReset();
    authSession.signOut.mockReset();
    authSession.markProtectedApiReady.mockReset();
    authSession.handleProtectedApiError.mockReset();
    authSession.canAccessProtectedRoutes.mockReset();
    authSession.handleProtectedApiError.mockReturnValue(false);
    authSession.canAccessProtectedRoutes.mockReturnValue(true);
    projectSnapshotsRepository.list.mockResolvedValue({ items: [] });
    projectSnapshotsRepository.get.mockResolvedValue(null);
    projectSnapshotsRepository.previewRestore.mockResolvedValue(null);
    projectSnapshotsRepository.create.mockResolvedValue(null);
    projectSnapshotsRepository.restore.mockResolvedValue(undefined);
    projectContractsRepository.exportContract.mockResolvedValue({
      text: '{"openapi":"3.0.3"}',
      filename: 'users-api-openapi.json',
      contentType: 'application/json',
      warnings: [],
    });
    projectContractsRepository.analyzeContract.mockResolvedValue({
      document: { title: 'Users API', version: '1.0.0', format: 'json' },
      summary: { create: 1, update: 0, delete: 0, warnings: 1, errors: 0 },
      operations: [{ method: 'POST', path: '/accounts', action: 'create', warnings: [] }],
      warnings: [{ code: 'missing-example', message: 'Placeholder', path: 'POST /accounts' }],
      errors: [],
    });
    projectContractsRepository.importContract.mockResolvedValue({
      document: { title: 'Users API', version: '1.0.0', format: 'json' },
      summary: { create: 1, update: 0, delete: 0, warnings: 1, errors: 0 },
      operations: [{ method: 'POST', path: '/accounts', action: 'create', warnings: [] }],
      warnings: [{ code: 'missing-example', message: 'Placeholder', path: 'POST /accounts' }],
      errors: [],
      committed: { created: 1, updated: 0, deleted: 0 },
    });
    authSession.snapshot.set({
      state: 'authenticated',
      userId: 'user-1',
      displayName: 'Owner User',
      username: 'owner.user',
      email: 'owner@example.com',
      emailVerified: true,
      headers: {
        authStatus: 'signed-in',
        userId: 'user-1',
        email: 'owner@example.com',
        emailVerified: true,
        displayName: 'Owner User',
      },
      reason: null,
    });
    authSession.accessState.set('ready');
    workspaceMembersRepository.listMembers.mockResolvedValue([] as WorkspaceMember[]);
    workspaceInvitationsRepository.listWorkspaceInvitations.mockResolvedValue([]);
    workspaceInvitationsRepository.listPendingInvitations.mockResolvedValue([]);
    workspacesRepository.listWorkspaces.mockResolvedValue([
      {
        id: 'workspace-1',
        name: 'Personal workspace',
        kind: 'personal',
        role: 'owner',
        isPersonal: true,
        capabilities: {
          canEdit: true,
          canManageMembers: true,
          canRestoreSnapshots: true,
          canImportContracts: true,
        },
      },
      {
        id: 'workspace-2',
        name: 'Equipo Plataforma',
        kind: 'team',
        role: 'editor',
        isPersonal: false,
        capabilities: {
          canEdit: true,
          canManageMembers: false,
          canRestoreSnapshots: false,
          canImportContracts: false,
        },
      },
    ]);

    projectsRepository.getProject.mockImplementation(async (projectId: string) =>
      projectId === secondProjectFixture.id ? secondProjectFixture : projectFixture,
    );
  });

  it('shows a recoverable error and clears project state when the initial project load fails', async () => {
    projectsRepository.listProjects.mockRejectedValue(new Error('Backend unavailable'));

    const component = createComponent();
    await flushAsyncWork();

    expect(component.projectsLoading()).toBe(false);
    expect(component.projectsError()).toBe('Backend unavailable');
    expect(component.projects()).toEqual([]);
    expect(component.selectedProjectId()).toBe('');
  });

  it('delegates sign out requests to the frontend auth session service', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));

    const component = createComponent() as WorkspaceShellTestApi & { signOut(): void };
    await flushAsyncWork();

    component.signOut();

    expect(authSession.signOut).toHaveBeenCalledTimes(1);
  });

  it('blocks viewer-only mutations from the current workspace slice', async () => {
    projectsRepository.listProjects.mockResolvedValue(
      pagedProjectsResult([
        {
          ...projectFixture,
          workspace: {
            id: 'workspace-1',
            role: 'viewer',
            capabilities: {
              canEdit: false,
              canManageMembers: false,
              canRestoreSnapshots: false,
              canImportContracts: false,
            },
          },
        },
      ]),
    );
    projectsRepository.getProject.mockResolvedValue({
      ...projectFixture,
      workspace: {
        id: 'workspace-1',
        role: 'viewer',
        capabilities: {
          canEdit: false,
          canManageMembers: false,
          canRestoreSnapshots: false,
          canImportContracts: false,
        },
      },
    });

    const component = createComponent();
    await flushAsyncWork();

    component.openEditProjectModal();
    component.openDeleteProjectDialog();
    component.createEndpoint();
    component.editGlobalConfig();
    component.onGlobalConfigSaved(normalizedConfigFixture);

    expect(component.editProjectModalOpen()).toBe(false);
    expect(component.deleteProjectDialogOpen()).toBe(false);
    expect(component.createEndpointFlowOpen()).toBe(false);
    expect(component.globalConfigDrawerOpen()).toBe(false);
    expect(globalConfigRepository.saveConfig).not.toHaveBeenCalled();
  });

  it('only allows owners to mutate workspace members', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    projectsRepository.getProject.mockResolvedValue(projectFixture);
    workspaceInvitationsRepository.createInvitation.mockResolvedValue({
      id: 'invite-1',
      workspaceId: 'workspace-1',
      workspaceName: 'Personal workspace',
      email: 'editor@example.com',
      role: 'editor',
      status: 'pending',
      createdAt: '2026-04-08T10:00:00.000Z',
    });
    workspaceMembersRepository.updateMemberRole.mockResolvedValue({
      userId: 'user-2',
      email: 'editor@example.com',
      displayName: 'Editor User',
      role: 'owner',
      createdAt: '2026-04-08T10:00:00.000Z',
    });
    workspaceMembersRepository.removeMember.mockResolvedValue(undefined);

    const component = createComponent();
    await flushAsyncWork();

    component.addWorkspaceMember({ email: 'editor@example.com', role: 'editor' });
    await flushAsyncWork();
    component.updateWorkspaceMemberRole({ memberUserId: 'user-2', role: 'owner' });
    await flushAsyncWork();
    component.removeWorkspaceMember('user-2');
    await flushAsyncWork();

    expect(workspaceInvitationsRepository.createInvitation).toHaveBeenCalledWith('workspace-1', {
      email: 'editor@example.com',
      role: 'editor',
    });
    expect(workspaceMembersRepository.updateMemberRole).toHaveBeenCalledWith('workspace-1', 'user-2', {
      role: 'owner',
    });
    expect(workspaceMembersRepository.removeMember).toHaveBeenCalledWith('workspace-1', 'user-2');

    projectsRepository.getProject.mockResolvedValue({
      ...projectFixture,
      workspace: {
        id: 'workspace-1',
        role: 'editor',
        capabilities: {
          canEdit: true,
          canManageMembers: false,
          canRestoreSnapshots: false,
          canImportContracts: false,
        },
      },
    });
    const editorComponent = createComponent();
    await flushAsyncWork();

    editorComponent.addWorkspaceMember({ email: 'viewer@example.com', role: 'viewer' });
    editorComponent.updateWorkspaceMemberRole({ memberUserId: 'user-2', role: 'owner' });
    editorComponent.removeWorkspaceMember('user-2');

    expect(workspaceInvitationsRepository.createInvitation).toHaveBeenCalledTimes(1);
    expect(workspaceMembersRepository.updateMemberRole).toHaveBeenCalledTimes(1);
    expect(workspaceMembersRepository.removeMember).toHaveBeenCalledTimes(1);
  });

  it('loads and accepts pending invitations for the authenticated actor', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    projectsRepository.getProject.mockResolvedValue(projectFixture);
    workspaceInvitationsRepository.listPendingInvitations.mockResolvedValue([
      {
        id: 'invite-1',
        workspaceId: 'workspace-2',
        workspaceName: 'Equipo Plataforma',
        email: 'owner@example.com',
        role: 'editor',
        status: 'pending',
        createdAt: '2026-04-08T10:10:00.000Z',
      },
    ]);
    workspaceInvitationsRepository.acceptInvitation.mockResolvedValue(undefined);

    const component = createComponent();
    await flushAsyncWork();

    expect(component.pendingWorkspaceInvitations()).toEqual([
      {
        id: 'invite-1',
        workspaceId: 'workspace-2',
        workspaceName: 'Equipo Plataforma',
        email: 'owner@example.com',
        role: 'editor',
        status: 'pending',
        createdAt: '2026-04-08T10:10:00.000Z',
      },
    ]);

    workspaceInvitationsRepository.listPendingInvitations.mockClear();

    component.acceptWorkspaceInvitation('invite-1');
    await flushAsyncWork();

    expect(workspaceInvitationsRepository.acceptInvitation).toHaveBeenCalledWith('invite-1');
    expect(workspaceInvitationsRepository.listPendingInvitations).toHaveBeenCalledTimes(2);
  });

  it('refreshes project summary and workspace members after updating a member role', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    projectsRepository.getProject.mockResolvedValue(projectFixture);
    workspaceMembersRepository.listMembers.mockResolvedValue([] as WorkspaceMember[]);
    workspaceMembersRepository.updateMemberRole.mockResolvedValue({
      userId: 'user-2',
      email: 'editor@example.com',
      displayName: 'Editor User',
      role: 'owner',
      createdAt: '2026-04-08T10:00:00.000Z',
    });

    const component = createComponent();
    await flushAsyncWork();
    projectsRepository.getProject.mockClear();
    workspaceMembersRepository.listMembers.mockClear();

    component.updateWorkspaceMemberRole({ memberUserId: 'user-2', role: 'owner' });
    await flushAsyncWork();

    expect(projectsRepository.getProject).toHaveBeenCalledWith('project-1');
    expect(workspaceMembersRepository.listMembers).toHaveBeenCalledWith('workspace-1');
  });

  it('reloads workspace members and exposes a workspace summary when the user navigates to the workspace section', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    projectsRepository.getProject.mockResolvedValue(projectFixture);
    workspaceMembersRepository.listMembers.mockResolvedValue([
      {
        userId: 'user-1',
        email: 'owner@example.com',
        displayName: 'Owner User',
        role: 'owner',
        createdAt: '2026-04-08T10:00:00.000Z',
      },
    ]);

    const component = createComponent();
    await flushAsyncWork();
    workspaceMembersRepository.listMembers.mockClear();

    component.selectNav('workspace');
    await flushAsyncWork();

    expect(component.activeNav()).toBe('workspace');
    expect(workspaceMembersRepository.listMembers).toHaveBeenCalledWith('workspace-1');
    expect(component.activeWorkspaceSummary()).toEqual({
      id: 'workspace-1',
      name: 'Personal workspace',
      role: 'owner',
      isPersonal: undefined,
      capabilities: {
        canEdit: true,
        canManageMembers: true,
        canRestoreSnapshots: true,
        canImportContracts: true,
      },
    });
  });

  it('hydrates the initially selected project with the real dashboard summary after loading the sidebar list', async () => {
    const summaryProject: DashboardProject = {
      ...projectFixture,
      metrics: {
        ...projectFixture.metrics,
        totalScenarios: 3,
      },
      recentRequests: [
        {
          id: 'log-1',
          method: 'GET',
          path: '/users',
          statusCode: 200,
          latencyMs: 84,
          scenarioType: 'success',
          createdAt: '2026-04-08T10:00:00.000Z',
          timeLabel: 'just now',
        },
      ],
    };

    projectsRepository.listProjects.mockResolvedValue({
      items: [projectFixture],
      page: { limit: 25, offset: 0, total: 1, hasMore: false },
    });
    projectsRepository.getProject.mockResolvedValue(summaryProject);

    const component = createComponent();
    await flushAsyncWork();

    expect(projectsRepository.listProjects).toHaveBeenCalledWith({ limit: 25, offset: 0 });
    expect(projectsRepository.getProject).toHaveBeenCalledWith('project-1');
    expect(component.selectedProjectId()).toBe('project-1');
    expect(component.activeProject()?.metrics.totalScenarios).toBe(3);
    expect(component.activeProject()?.recentRequests).toHaveLength(1);
  });

  it('loads the next project page without resetting the active workspace shell state', async () => {
    const pageOne = {
      items: [projectFixture],
      page: { limit: 25, offset: 0, total: 30, hasMore: true },
    };
    const pageTwo = {
      items: [secondProjectFixture],
      page: { limit: 25, offset: 25, total: 30, hasMore: false },
    };

    projectsRepository.listProjects.mockResolvedValueOnce(pageOne).mockResolvedValueOnce(pageTwo);

    const component = createComponent();
    await flushAsyncWork();

    component.loadMoreProjects();
    expect(component.projectsLoadingMore()).toBe(true);

    await flushAsyncWork();

    expect(projectsRepository.listProjects).toHaveBeenNthCalledWith(1, { limit: 25, offset: 0 });
    expect(projectsRepository.listProjects).toHaveBeenNthCalledWith(2, { limit: 25, offset: 1 });
    expect(component.projects().map((project) => project.id)).toEqual(['project-1', 'project-2']);
    expect(component.selectedProjectId()).toBe('project-1');
    expect(component.projectsPage().hasMore).toBe(false);
    expect(component.projectsLoadMoreError()).toBe(null);
    expect(component.projectsLoadingMore()).toBe(false);
  });

  it('keeps the current project list visible when loading the next page fails', async () => {
    projectsRepository.listProjects
      .mockResolvedValueOnce({
        items: [projectFixture],
        page: { limit: 25, offset: 0, total: 30, hasMore: true },
      })
      .mockRejectedValueOnce(new Error('Could not fetch the next page.'));

    const component = createComponent();
    await flushAsyncWork();

    component.loadMoreProjects();
    await flushAsyncWork();

    expect(component.projects()).toEqual([projectFixture]);
    expect(component.selectedProjectId()).toBe('project-1');
    expect(component.projectsLoadMoreError()).toBe('Could not fetch the next page.');
    expect(component.projectsError()).toBe(null);
  });

  it('reloads the dashboard summary when the user changes the active project', async () => {
    const summaryProjectOne: DashboardProject = {
      ...projectFixture,
      metrics: {
        ...projectFixture.metrics,
        totalScenarios: 2,
      },
    };
    const summaryProjectTwo: DashboardProject = {
      ...secondProjectFixture,
      status: 'running',
      metrics: {
        ...secondProjectFixture.metrics,
        totalEndpoints: 2,
        totalScenarios: 4,
      },
      endpointRows: [
        {
          endpointId: 'ep-2',
          method: 'POST',
          path: '/billing',
          description: 'Create invoice',
          scenarioCount: 4,
          latencyMs: 90,
          errorRatePct: 0,
          status: 'ready',
        },
      ],
      endpoints: [
        {
          id: 'ep-2',
          method: 'POST',
          path: '/billing',
          description: 'Create invoice',
          latencyMs: 90,
          statusCode: 200,
          responseBody: { ok: true },
        },
      ],
    };

    projectsRepository.listProjects.mockResolvedValue({
      items: [projectFixture, secondProjectFixture],
      page: { limit: 25, offset: 0, total: 2, hasMore: false },
    });
    projectsRepository.getProject.mockResolvedValueOnce(summaryProjectOne).mockResolvedValueOnce(summaryProjectTwo);

    const component = createComponent();
    await flushAsyncWork();

    component.selectProject('project-2');
    await flushAsyncWork();

    expect(projectsRepository.getProject).toHaveBeenNthCalledWith(1, 'project-1');
    expect(projectsRepository.getProject).toHaveBeenNthCalledWith(2, 'project-2');
    expect(component.selectedProjectId()).toBe('project-2');
    expect(component.activeProject()?.metrics.totalScenarios).toBe(4);
    expect(component.activeProject()?.endpoints[0]?.path).toBe('/billing');
  });

  it('opens the config drawer with normalized values after loading backend config', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    globalConfigRepository.getConfig.mockResolvedValue(normalizedConfigFixture);

    const component = createComponent();
    await flushAsyncWork();

    component.editGlobalConfig();
    expect(component.globalConfigDrawerOpen()).toBe(true);
    expect(component.globalConfigLoading()).toBe(true);

    await flushAsyncWork();

    expect(globalConfigRepository.getConfig).toHaveBeenCalledWith('project-1');
    expect(component.globalConfigLoading()).toBe(false);
    expect(component.globalConfig()).toEqual(normalizedConfigFixture);
    expect(component.globalConfig().logging.level).toBe('none');
    expect(component.globalConfig().scope).toBe('all');
  });

  it('keeps the config drawer open and surfaces actionable feedback when save fails validation', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    globalConfigRepository.saveConfig.mockRejectedValue(
      new Error('Validation failed: latency max must be greater than latency min.'),
    );

    const component = createComponent();
    await flushAsyncWork();
    component.globalConfigDrawerOpen.set(true);

    component.onGlobalConfigSaved(normalizedConfigFixture);
    expect(component.globalConfigSaving()).toBe(true);

    await flushAsyncWork();

    expect(globalConfigRepository.saveConfig).toHaveBeenCalledWith('project-1', normalizedConfigFixture);
    expect(component.globalConfigDrawerOpen()).toBe(true);
    expect(component.globalConfigSaving()).toBe(false);
    expect(component.globalConfigError()).toBe('Validation failed: latency max must be greater than latency min.');
  });

  it('refreshes the active dashboard project after saving global config so summary badges stay current', async () => {
    const refreshedProject: DashboardProject = {
      ...projectFixture,
      configSummary: {
        ...projectFixture.configSummary,
        logging: { level: 'full' },
      },
    };

    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    projectsRepository.getProject.mockResolvedValue(refreshedProject);
    globalConfigRepository.saveConfig.mockResolvedValue(normalizedConfigFixture);

    const component = createComponent();
    await flushAsyncWork();

    component.onGlobalConfigSaved(normalizedConfigFixture);
    await flushAsyncWork();

    expect(globalConfigRepository.saveConfig).toHaveBeenCalledWith('project-1', normalizedConfigFixture);
    expect(projectsRepository.getProject).toHaveBeenCalledWith('project-1');
    expect(component.projects()[0]?.configSummary.logging.level).toBe('full');
  });

  it('creates a project and generates the first endpoint through the AI backend flow', async () => {
    const createdProject: DashboardProject = {
      ...projectFixture,
      id: 'project-2',
      name: 'Manual API',
      endpoints: [],
    };

    projectsRepository.listProjects
      .mockResolvedValueOnce(pagedProjectsResult([]))
      .mockResolvedValueOnce(pagedProjectsResult([createdProject]));
    projectsRepository.createProject.mockResolvedValue(createdProject);
    endpointsRepository.generateAiEndpoint.mockResolvedValue(endpointFixture);

    const component = createComponent();
    await flushAsyncWork();

    component.onCreateProjectModalWithEndpoint({
      name: 'Manual API',
      description: 'Created manually',
      workspaceId: 'workspace-2',
      endpointPrompt: 'POST /orders',
    });

    await flushAsyncWork(6);

    expect(projectsRepository.createProject).toHaveBeenCalledWith({
      name: 'Manual API',
      description: 'Created manually',
      workspaceId: 'workspace-2',
    });
    expect(endpointsRepository.generateAiEndpoint).toHaveBeenCalledWith('project-2', 'POST /orders');
    expect(projectsRepository.listProjects).toHaveBeenCalledTimes(2);
    expect(component.selectedProjectId()).toBe('project-2');
  });

  it('opens the wizard in ai, manual, and edit modes without mixing caller state', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));

    const component = createComponent();
    await flushAsyncWork();

    component.createEndpoint();
    expect(component.createEndpointFlowOpen()).toBe(true);
    expect(component.endpointWizardMode()).toBe('ai');

    component.createEndpointFlowOpen.set(false);
    component.createEndpoint('manual');
    expect(component.createEndpointFlowOpen()).toBe(true);
    expect(component.endpointWizardMode()).toBe('manual');

    component.editEndpoint(endpointFixture);
    expect(component.createEndpointFlowOpen()).toBe(true);
    expect(component.endpointWizardMode()).toBe('edit');
  });

  it('prevents duplicate create-project submissions while the AI generation flow is still pending', async () => {
    let resolveCreate!: (value: DashboardProject) => void;
    let resolveGenerate!: (value: EndpointPreview) => void;

    const createPromise = new Promise<DashboardProject>((resolve) => {
      resolveCreate = resolve;
    });
    const generatePromise = new Promise<EndpointPreview>((resolve) => {
      resolveGenerate = resolve;
    });

    const createdProject: DashboardProject = {
      ...projectFixture,
      id: 'project-2',
      name: 'Async API',
      endpoints: [],
    };

    projectsRepository.listProjects
      .mockResolvedValueOnce(pagedProjectsResult([]))
      .mockResolvedValueOnce(pagedProjectsResult([createdProject]));
    projectsRepository.createProject.mockReturnValue(createPromise);
    endpointsRepository.generateAiEndpoint.mockReturnValue(generatePromise);

    const component = createComponent();
    await flushAsyncWork();

    component.onCreateProjectModalWithEndpoint({
      name: 'Async API',
      description: 'Pending flow',
      endpointPrompt: 'POST /orders',
    });
    component.onCreateProjectModalWithEndpoint({
      name: 'Async API duplicate',
      description: 'Second click',
      endpointPrompt: 'POST /orders',
    });

    expect(projectsRepository.createProject).toHaveBeenCalledTimes(1);
    expect(component.createProjectModalLoading()).toBe(true);

    resolveCreate(createdProject);
    await flushAsyncWork();
    expect(endpointsRepository.generateAiEndpoint).toHaveBeenCalledTimes(1);

    resolveGenerate(endpointFixture);
    await flushAsyncWork(6);

    expect(component.createProjectModalLoading()).toBe(false);
  });

  it('routes partial project success into the shared manual endpoint flow', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));

    const component = createComponent();
    await flushAsyncWork();

    component.createProjectModalOpen.set(true);
    component.createProjectPartialState.set({
      createdProjectId: 'project-1',
      projectName: 'Workspace project',
      endpointPrompt: 'Create users endpoint',
      message: 'Project created, endpoint missing.',
      retryable: true,
    });

    component.continueCreateProjectManually();

    expect(component.selectedProjectId()).toBe('project-1');
    expect(component.createProjectModalOpen()).toBe(false);
    expect(component.createProjectPartialState()).toBe(null);
    expect(component.activeNav()).toBe('endpoints');
    expect(component.createEndpointFlowOpen()).toBe(true);
    expect(component.endpointWizardMode()).toBe('manual');
  });

  it('uses the real workspace identity instead of faking workspace name from the project name', async () => {
    projectsRepository.listProjects.mockResolvedValue(
      pagedProjectsResult([
        {
          ...projectFixture,
          name: 'Payments API',
          workspace: {
            ...projectFixture.workspace,
            name: 'Equipo Plataforma',
            kind: 'team',
          },
        },
      ]),
    );
    const component = createComponent();
    await flushAsyncWork();

    expect(component.activeWorkspaceSummary()).toEqual({
      id: 'workspace-1',
      name: 'Personal workspace',
      role: 'owner',
      isPersonal: undefined,
      capabilities: {
        canEdit: true,
        canManageMembers: true,
        canRestoreSnapshots: true,
        canImportContracts: true,
      },
    });
  });

  it('loads accessible workspaces and forwards the selected workspaceId when creating a project', async () => {
    projectsRepository.listProjects
      .mockResolvedValueOnce(pagedProjectsResult([projectFixture]))
      .mockResolvedValueOnce(pagedProjectsResult([projectFixture]));
    projectsRepository.createProject.mockResolvedValue({ ...projectFixture, id: 'project-2' });

    const component = createComponent();
    await flushAsyncWork();

    component.openCreateProjectModal();
    await flushAsyncWork();
    component.onCreateProjectModalProjectOnly({
      name: 'Generated API',
      description: 'Workspace scoped',
      workspaceId: 'workspace-2',
    });
    await flushAsyncWork();

    expect(workspacesRepository.listWorkspaces).toHaveBeenCalledTimes(1);
    expect(projectsRepository.createProject).toHaveBeenCalledWith({
      name: 'Generated API',
      description: 'Workspace scoped',
      workspaceId: 'workspace-2',
    });
  });

  it('updates the active project and keeps it selected after a successful edit', async () => {
    const updatedProject: DashboardProject = {
      ...projectFixture,
      name: 'Renamed workspace',
      description: 'Fresh description',
    };

    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    projectsRepository.updateProject.mockResolvedValue(updatedProject);

    const component = createComponent();
    await flushAsyncWork();

    component.openEditProjectModal();
    expect(component.editProjectModalOpen()).toBe(true);

    component.onEditProjectModalSave({
      name: 'Renamed workspace',
      description: 'Fresh description',
      slug: 'project-1',
    });

    await flushAsyncWork();

    expect(projectsRepository.updateProject).toHaveBeenCalledWith('project-1', {
      name: 'Renamed workspace',
      description: 'Fresh description',
      slug: 'project-1',
    });
    expect(component.selectedProjectId()).toBe('project-1');
    expect(component.projects()[0]?.name).toBe('Renamed workspace');
    expect(component.editProjectModalOpen()).toBe(false);
  });

  it('loads accessible workspaces for edit mode and preselects the current workspace', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));

    const component = createComponent();
    await flushAsyncWork();

    component.openEditProjectModal();
    await flushAsyncWork();

    expect(workspacesRepository.listWorkspaces).toHaveBeenCalledTimes(1);
    expect(component.availableWorkspaces()).toEqual([
      expect.objectContaining({ id: 'workspace-1' }),
      expect.objectContaining({ id: 'workspace-2' }),
    ]);
    expect(component.editProjectInitialValues()).toEqual({
      name: 'Workspace project',
      description: 'Live backend project',
      slug: 'project-1',
      workspaceId: 'workspace-1',
    });
  });

  it('refreshes workspace members after transferring the active project to another workspace', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    projectsRepository.updateProject.mockResolvedValue({
      ...projectFixture,
      workspace: {
        id: 'workspace-2',
        name: 'Equipo Plataforma',
        kind: 'team',
        role: 'editor',
        isPersonal: false,
        capabilities: {
          canEdit: true,
          canManageMembers: false,
          canRestoreSnapshots: false,
          canImportContracts: false,
        },
      },
    });
    workspaceMembersRepository.listMembers.mockResolvedValue([] as WorkspaceMember[]);

    const component = createComponent();
    await flushAsyncWork();

    component.activeNav.set('workspace');
    component.workspaceMembers.set([
      {
        userId: 'user-legacy',
        email: 'legacy@example.com',
        displayName: 'Legacy',
        role: 'owner',
        createdAt: '2026-04-08T10:00:00.000Z',
      },
    ]);
    workspaceMembersRepository.listMembers.mockClear();

    component.onEditProjectModalSave({
      name: 'Workspace project',
      description: 'Demo project',
      slug: 'project-1',
      workspaceId: 'workspace-2',
    });
    await flushAsyncWork();

    expect(workspaceMembersRepository.listMembers).toHaveBeenCalledWith('workspace-2');
    expect(component.activeWorkspaceSummary()).toEqual({
      id: 'workspace-2',
      name: 'Equipo Plataforma',
      role: 'editor',
      isPersonal: false,
      capabilities: {
        canEdit: true,
        canManageMembers: false,
        canRestoreSnapshots: false,
        canImportContracts: false,
      },
    });
  });

  it('prevents duplicate edit submissions while the repository update is pending', async () => {
    let resolveUpdate!: (value: DashboardProject) => void;
    const updatePromise = new Promise<DashboardProject>((resolve) => {
      resolveUpdate = resolve;
    });

    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    projectsRepository.updateProject.mockReturnValue(updatePromise);

    const component = createComponent();
    await flushAsyncWork();

    component.openEditProjectModal();
    component.onEditProjectModalSave({
      name: 'Renamed workspace',
      description: 'Fresh description',
      slug: 'project-1',
    });
    component.onEditProjectModalSave({ name: 'Renamed again', description: 'Second click', slug: 'project-2' });

    expect(projectsRepository.updateProject).toHaveBeenCalledTimes(1);
    expect(component.editProjectModalLoading()).toBe(true);

    resolveUpdate({ ...projectFixture, name: 'Renamed workspace', description: 'Fresh description' });
    await flushAsyncWork();

    expect(component.editProjectModalLoading()).toBe(false);
  });

  it('keeps the edit modal open and shows actionable feedback when project update fails', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    projectsRepository.updateProject.mockRejectedValue(new Error('Name already exists in this workspace.'));

    const component = createComponent();
    await flushAsyncWork();

    component.openEditProjectModal();
    component.onEditProjectModalSave({ name: 'Duplicated', description: 'Fresh description', slug: 'project-1' });

    await flushAsyncWork();

    expect(component.editProjectModalOpen()).toBe(true);
    expect(component.editProjectError()).toBe('Name already exists in this workspace.');
    expect(component.selectedProjectId()).toBe('project-1');
  });

  it('shows duplicate-slug feedback when backend rejects project slug reuse', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    projectsRepository.updateProject.mockRejectedValue(
      new ApiError(409, 'Project slug already exists', undefined, 'PROJECT_SLUG_DUPLICATE'),
    );

    const component = createComponent();
    await flushAsyncWork();

    component.openEditProjectModal();
    component.onEditProjectModalSave({ name: 'Renamed', description: 'Fresh', slug: 'project-2' });

    await flushAsyncWork();

    expect(component.editProjectError()).toBe('This mock route slug is already in use. Try a different slug.');
  });

  it('shows reserved-slug feedback when backend blocks protected slug names', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    projectsRepository.updateProject.mockRejectedValue(
      new ApiError(409, 'Project slug is reserved', undefined, 'PROJECT_SLUG_RESERVED'),
    );

    const component = createComponent();
    await flushAsyncWork();

    component.openEditProjectModal();
    component.onEditProjectModalSave({ name: 'Renamed', description: 'Fresh', slug: 'mock' });

    await flushAsyncWork();

    expect(component.editProjectError()).toBe('This slug is reserved by the platform. Choose another one.');
  });

  it('cleans project-scoped state and reselects another project after delete succeeds', async () => {
    projectsRepository.listProjects
      .mockResolvedValueOnce(pagedProjectsResult([projectFixture, secondProjectFixture]))
      .mockResolvedValueOnce(pagedProjectsResult([secondProjectFixture]));
    projectsRepository.deleteProject.mockResolvedValue(undefined);

    const component = createComponent();
    await flushAsyncWork();

    component.selectedEndpointId.set('ep-1');
    component.selectedLog.set(logFixture);
    component.globalConfigDrawerOpen.set(true);
    component.createEndpointFlowOpen.set(true);
    component.activeNav.set('dashboard');

    component.openDeleteProjectDialog();
    component.confirmDeleteProject();

    expect(component.deleteProjectPending()).toBe(true);

    await flushAsyncWork(6);

    expect(projectsRepository.deleteProject).toHaveBeenCalledWith('project-1');
    expect(component.selectedEndpointId()).toBe(null);
    expect(component.selectedLog()).toBe(null);
    expect(component.globalConfigDrawerOpen()).toBe(false);
    expect(component.createEndpointFlowOpen()).toBe(false);
    expect(component.selectedProjectId()).toBe('project-2');
    expect(component.deleteProjectDialogOpen()).toBe(false);
  });

  it('does not send delete and keeps the active project selected when deletion is cancelled', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture, secondProjectFixture]));

    const component = createComponent();
    await flushAsyncWork();

    component.openDeleteProjectDialog();
    component.closeDeleteProjectDialog();

    expect(projectsRepository.deleteProject).not.toHaveBeenCalled();
    expect(component.selectedProjectId()).toBe('project-1');
    expect(component.activeProject()?.id).toBe('project-1');
    expect(component.deleteProjectDialogOpen()).toBe(false);
  });

  it('returns to the dashboard empty state after deleting the last project', async () => {
    projectsRepository.listProjects
      .mockResolvedValueOnce(pagedProjectsResult([projectFixture]))
      .mockResolvedValueOnce(pagedProjectsResult([]));
    projectsRepository.deleteProject.mockResolvedValue(undefined);

    const component = createComponent();
    await flushAsyncWork();

    component.activeNav.set('logs');
    component.openDeleteProjectDialog();
    component.confirmDeleteProject();

    await flushAsyncWork(6);

    expect(component.projects()).toEqual([]);
    expect(component.selectedProjectId()).toBe('');
    expect(component.activeNav()).toBe('dashboard');
  });

  it('keeps the destructive confirmation open with feedback when delete fails', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    projectsRepository.deleteProject.mockRejectedValue(new Error('Delete failed on server.'));

    const component = createComponent();
    await flushAsyncWork();

    component.openDeleteProjectDialog();
    component.confirmDeleteProject();

    await flushAsyncWork();

    expect(component.deleteProjectDialogOpen()).toBe(true);
    expect(component.deleteProjectError()).toBe('Delete failed on server.');
    expect(component.selectedProjectId()).toBe('project-1');
  });

  it('stores analyze results so the user can review warnings before importing', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));

    const component = createComponent();
    await flushAsyncWork();

    component.contractImportReview.set({
      file: new File(['{}'], 'contract.json', { type: 'application/json' }),
      analysis: {
        document: { title: 'Users API', version: '1.0.0', format: 'json' },
        summary: { create: 1, update: 0, delete: 0, warnings: 1, errors: 0 },
        operations: [{ method: 'POST', path: '/accounts', action: 'create', warnings: [] }],
        warnings: [{ code: 'missing-example', message: 'Placeholder', path: 'POST /accounts' }],
        errors: [],
      },
    });

    expect(component.contractImportReview()).toMatchObject({
      file: expect.objectContaining({ name: 'contract.json' }),
      analysis: expect.objectContaining({ summary: expect.objectContaining({ create: 1, warnings: 1 }) }),
    });

    component.cancelContractImportReview();
    expect(component.contractImportReview()).toBe(null);
  });

  it('opens a restore preview first and only restores after explicit confirmation', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));
    projectSnapshotsRepository.previewRestore.mockResolvedValue({
      snapshotId: 'snapshot-1',
      snapshotName: 'Before imports',
      revision: {
        endpointCount: 2,
        scenarioCount: 3,
        globalScope: 'unset',
        projectSlug: 'workspace-project',
        projectName: 'Snapshot project',
        isLegacySnapshot: false,
      },
      project: {
        name: { current: 'Workspace project', snapshot: 'Snapshot project', changed: true },
        description: { current: 'Live backend project', snapshot: 'Snapshot description', changed: true },
      },
      globalConfig: {
        changed: true,
        changes: [{ field: 'scope', current: 'all', snapshot: 'unset' }],
      },
      endpoints: {
        create: [{ key: 'POST /users', method: 'POST', path: '/users' }],
        update: [{ key: 'GET /users', method: 'GET', path: '/users' }],
        delete: [{ key: 'DELETE /users/:id', method: 'DELETE', path: '/users/:id' }],
        keep: [],
      },
      counts: { create: 1, update: 1, delete: 1, keep: 0, totalAfterRestore: 2 },
    });

    const component = createComponent();
    await flushAsyncWork();

    await component.restoreSnapshot('snapshot-1');

    expect(projectSnapshotsRepository.previewRestore).toHaveBeenCalledWith('project-1', 'snapshot-1');
    expect(projectSnapshotsRepository.restore).not.toHaveBeenCalled();
    expect(component.restorePreviewDialogOpen()).toBe(true);
    expect(component.restorePreviewState()).toMatchObject({ snapshotId: 'snapshot-1', snapshotName: 'Before imports' });
    expect(component.restorePreviewState()?.preview.revision.scenarioCount).toBe(3);

    await component.confirmRestoreSnapshot();
    await flushAsyncWork();

    expect(projectSnapshotsRepository.restore).toHaveBeenCalledWith('project-1', 'snapshot-1');
    expect(component.restorePreviewDialogOpen()).toBe(false);
  });

  it('does not open snapshot restore flows for editors without the explicit restore capability', async () => {
    projectsRepository.listProjects.mockResolvedValue(
      pagedProjectsResult([
        {
          ...projectFixture,
          workspace: {
            ...projectFixture.workspace,
            role: 'editor',
            capabilities: {
              canEdit: true,
              canManageMembers: false,
              canRestoreSnapshots: false,
              canImportContracts: false,
            },
          },
        },
      ]),
    );
    projectsRepository.getProject.mockResolvedValue({
      ...projectFixture,
      workspace: {
        ...projectFixture.workspace,
        role: 'editor',
        capabilities: {
          canEdit: true,
          canManageMembers: false,
          canRestoreSnapshots: false,
          canImportContracts: false,
        },
      },
    });

    const component = createComponent();
    await flushAsyncWork();

    await component.restoreSnapshot('snapshot-1');

    expect(projectSnapshotsRepository.previewRestore).not.toHaveBeenCalled();
    expect(projectSnapshotsRepository.restore).not.toHaveBeenCalled();
    expect(component.restorePreviewDialogOpen()).toBe(false);
  });

  it('commits the reviewed contract import through the backend repository', async () => {
    projectsRepository.listProjects.mockResolvedValue(pagedProjectsResult([projectFixture]));

    const component = createComponent();
    await flushAsyncWork();
    const file = new File(['{}'], 'contract.json', { type: 'application/json' });

    component.contractImportReview.set({
      file,
      analysis: {
        document: { title: 'Users API', version: '1.0.0', format: 'json' },
        summary: { create: 1, update: 0, delete: 0, warnings: 0, errors: 0 },
        operations: [{ method: 'POST', path: '/accounts', action: 'create', warnings: [] }],
        warnings: [],
        errors: [],
      },
    });

    component.confirmContractImport();
    await flushAsyncWork();

    expect(projectContractsRepository.importContract).toHaveBeenCalledWith('project-1', file);
    expect(component.contractImportReview()).toBe(null);
  });

  it('does not commit contract import for editors without the explicit import capability', async () => {
    projectsRepository.listProjects.mockResolvedValue(
      pagedProjectsResult([
        {
          ...projectFixture,
          workspace: {
            ...projectFixture.workspace,
            role: 'editor',
            capabilities: {
              canEdit: true,
              canManageMembers: false,
              canRestoreSnapshots: false,
              canImportContracts: false,
            },
          },
        },
      ]),
    );
    projectsRepository.getProject.mockResolvedValue({
      ...projectFixture,
      workspace: {
        ...projectFixture.workspace,
        role: 'editor',
        capabilities: {
          canEdit: true,
          canManageMembers: false,
          canRestoreSnapshots: false,
          canImportContracts: false,
        },
      },
    });

    const component = createComponent();
    await flushAsyncWork();
    const file = new File(['{}'], 'contract.json', { type: 'application/json' });

    component.contractImportReview.set({
      file,
      analysis: {
        document: { title: 'Users API', version: '1.0.0', format: 'json' },
        summary: { create: 1, update: 0, delete: 0, warnings: 0, errors: 0 },
        operations: [{ method: 'POST', path: '/accounts', action: 'create', warnings: [] }],
        warnings: [],
        errors: [],
      },
    });

    component.confirmContractImport();
    await flushAsyncWork();

    expect(projectContractsRepository.importContract).not.toHaveBeenCalled();
    expect(component.contractImportReview()).not.toBe(null);
  });
});
