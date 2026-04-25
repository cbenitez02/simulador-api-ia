import { Injector, runInInjectionContext, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, map } from 'rxjs';
import { provideAngularReactiveSchedulers, setupAngularVitest } from '../../testing/angular-vitest';
import { FrontendAuthSessionService } from '../../shared/auth/frontend-auth-session.service';
import { AuditHistoryComponent } from '../audit-history/audit-history.component';
import { AuditHistoryRepository } from '../audit-history/data-access/audit-history.repository';
import { ProjectSnapshotsRepository } from '../project-snapshots/data-access/project-snapshots.repository';
import { ProjectContractsRepository } from './data-access/project-contracts.repository';
import { ProjectsRepository } from '../main-dashboard/data-access/projects.repository';
import { EndpointsRepository } from '../endpoints/data-access/endpoints.repository';
import { GlobalConfigRepository } from '../global-config/data-access/global-config.repository';
import { WorkspaceMembersRepository } from '../workspace-members/data-access/workspace-members.repository';
import { WorkspaceShellComponent } from './workspace-shell.component';

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

type WorkspaceShellHarness = WorkspaceShellComponent & {
  activeNav: {
    (): 'dashboard' | 'logs' | 'endpoints' | 'history';
    set(value: 'dashboard' | 'logs' | 'endpoints' | 'history'): void;
  };
  selectedProjectId: () => string;
  selectNav(value: 'dashboard' | 'logs' | 'endpoints' | 'history'): void;
  hasProjects: () => boolean;
};

async function flushAsyncWork(cycles = 6): Promise<void> {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
}

describe('WorkspaceShellComponent audit history integration', () => {
  const projectsRepository = {
    listProjects: vi.fn(),
    createProject: vi.fn(),
    getProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
  };

  const auditHistoryRepository = {
    listEvents: vi.fn(),
  };

  const projectSnapshotsRepository = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    restore: vi.fn(),
  };

  const projectContractsRepository = {
    exportContract: vi.fn(),
    analyzeContract: vi.fn(),
    importContract: vi.fn(),
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
    removeMember: vi.fn(),
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

  beforeEach(() => {
    projectsRepository.listProjects.mockReset();
    projectsRepository.getProject.mockReset();
    auditHistoryRepository.listEvents.mockReset();
    projectSnapshotsRepository.list.mockReset();
    projectSnapshotsRepository.get.mockReset();
    projectSnapshotsRepository.create.mockReset();
    projectSnapshotsRepository.restore.mockReset();
    projectContractsRepository.exportContract.mockReset();
    projectContractsRepository.analyzeContract.mockReset();
    projectContractsRepository.importContract.mockReset();
    workspaceMembersRepository.listMembers.mockReset();
    workspaceMembersRepository.listMembers.mockResolvedValue([]);
    projectSnapshotsRepository.list.mockResolvedValue({ items: [] });
    projectContractsRepository.exportContract.mockResolvedValue({
      text: '{"openapi":"3.0.3"}',
      filename: 'users-api-openapi.json',
      contentType: 'application/json',
      warnings: [],
    });
    projectContractsRepository.analyzeContract.mockResolvedValue({
      document: { title: 'Users API', version: '1.0.0', format: 'json' },
      summary: { create: 0, update: 0, delete: 0, warnings: 0, errors: 0 },
      operations: [],
      warnings: [],
      errors: [],
    });
    projectContractsRepository.importContract.mockResolvedValue({
      document: { title: 'Users API', version: '1.0.0', format: 'json' },
      summary: { create: 0, update: 0, delete: 0, warnings: 0, errors: 0 },
      operations: [],
      warnings: [],
      errors: [],
      committed: { created: 0, updated: 0, deleted: 0 },
    });
  });

  async function renderHistorySnapshot(injector: Injector, projectId: string): Promise<string> {
    const history = runInInjectionContext(injector, () => new AuditHistoryComponent()) as unknown as {
      projectId: () => string;
      loadProject(projectId: string): Promise<void>;
      entries: () => Array<{ actorLabel: string; action: string; resourceLabel: string; summary: string }>;
    };

    history.projectId = () => projectId;
    await history.loadProject(projectId);
    return history
      .entries()
      .map((entry) => `${entry.actorLabel} | ${entry.action} | ${entry.resourceLabel} | ${entry.summary}`)
      .join(' || ');
  }

  function createComponent() {
    const { route, router } = createWorkspaceRouterTestDoubles();
    const injector = Injector.create({
      providers: [
        ...provideAngularReactiveSchedulers(),
        { provide: ProjectsRepository, useValue: projectsRepository },
        { provide: AuditHistoryRepository, useValue: auditHistoryRepository },
        { provide: ProjectSnapshotsRepository, useValue: projectSnapshotsRepository },
        { provide: ProjectContractsRepository, useValue: projectContractsRepository },
        { provide: EndpointsRepository, useValue: endpointsRepository },
        { provide: GlobalConfigRepository, useValue: globalConfigRepository },
        { provide: WorkspaceMembersRepository, useValue: workspaceMembersRepository },
        { provide: FrontendAuthSessionService, useValue: authSession },
        { provide: ActivatedRoute, useValue: route },
        { provide: Router, useValue: router },
      ],
    });

    const component = runInInjectionContext(
      injector,
      () => new WorkspaceShellComponent(),
    ) as unknown as WorkspaceShellHarness & WorkspaceShellComponent;
    component.ngOnInit();

    return {
      component,
      injector,
    };
  }

  it('keeps the selected project and routes history navigation through the audit panel', async () => {
    projectsRepository.listProjects.mockResolvedValue({
      items: [
        {
          id: 'project-1',
          name: 'Workspace project',
          slug: 'workspace-project',
          workspace: { id: 'workspace-1', role: 'owner', capabilities: { canEdit: true, canManageMembers: true } },
          status: 'running',
          mockUrl: 'https://mock.example.com/workspace-project',
          description: 'Live backend project',
          lastUpdatedRelative: 'just now',
          metrics: { totalEndpoints: 1, totalScenarios: 1, avgLatencyMs: 84, errorRatePct: 0, totalRequests: 0 },
          health: {
            readyEndpoints: 1,
            needsAttentionEndpoints: 0,
            errorScenarioEndpoints: 0,
            emptyScenarioEndpoints: 0,
            timeoutScenarioEndpoints: 0,
          },
          endpointRows: [],
          endpointRowsMeta: { total: 0, limit: 25, hasMore: false },
          recentRequests: [],
          configSummary: {
            latency: { enabled: false, mode: 'fixed', minMs: 0, maxMs: 1000 },
            errorSimulation: { enabled: false, ratePct: 0, codes: [500] },
            rateLimiting: { enabled: false, rpm: 60 },
            logging: { level: 'basic' },
            scope: 'all',
          },
          endpoints: [],
        },
      ],
      page: { limit: 25, offset: 0, total: 1, hasMore: false },
    });
    projectsRepository.getProject.mockImplementation(
      async () => (await projectsRepository.listProjects.mock.results[0]!.value).items[0],
    );
    auditHistoryRepository.listEvents.mockResolvedValue({
      items: [
        {
          id: 'audit-1',
          actor: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User' },
          actorLabel: 'Owner User',
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          resourceType: 'project',
          resourceId: 'project-1',
          resourceLabel: 'Workspace project',
          action: 'created',
          actionLabel: 'created',
          summary: 'Created project Workspace project',
          metadata: { projectName: 'Workspace project' },
          createdAt: '2026-04-14T12:00:00.000Z',
          timeLabel: '12:00:00',
        },
      ],
      nextCursor: null,
      serverTime: '2026-04-14T12:00:05.000Z',
    });

    const { component, injector } = createComponent();
    await flushAsyncWork();

    component.selectNav('history');
    await flushAsyncWork();
    const snapshot = await renderHistorySnapshot(injector, component.selectedProjectId());

    expect(component.activeNav()).toBe('history');
    expect(component.selectedProjectId()).toBe('project-1');
    expect(snapshot).toContain('Owner User');
    expect(snapshot).toContain('created');
    expect(snapshot).toContain('Workspace project');
  });

  it('loads snapshot history for the selected project and restores from snapshot audit entries', async () => {
    projectsRepository.listProjects.mockResolvedValue({
      items: [
        {
          id: 'project-1',
          name: 'Workspace project',
          slug: 'workspace-project',
          workspace: { id: 'workspace-1', role: 'owner', capabilities: { canEdit: true, canManageMembers: true } },
          status: 'running',
          mockUrl: 'https://mock.example.com/workspace-project',
          description: 'Live backend project',
          lastUpdatedRelative: 'just now',
          metrics: { totalEndpoints: 1, totalScenarios: 1, avgLatencyMs: 84, errorRatePct: 0, totalRequests: 0 },
          health: {
            readyEndpoints: 1,
            needsAttentionEndpoints: 0,
            errorScenarioEndpoints: 0,
            emptyScenarioEndpoints: 0,
            timeoutScenarioEndpoints: 0,
          },
          endpointRows: [],
          endpointRowsMeta: { total: 0, limit: 25, hasMore: false },
          recentRequests: [],
          configSummary: {
            latency: { enabled: false, mode: 'fixed', minMs: 0, maxMs: 1000 },
            errorSimulation: { enabled: false, ratePct: 0, codes: [500] },
            rateLimiting: { enabled: false, rpm: 60 },
            logging: { level: 'basic' },
            scope: 'all',
          },
          endpoints: [],
        },
      ],
      page: { limit: 25, offset: 0, total: 1, hasMore: false },
    });
    projectsRepository.getProject.mockImplementation(
      async () => (await projectsRepository.listProjects.mock.results[0]!.value).items[0],
    );
    auditHistoryRepository.listEvents.mockResolvedValue({
      items: [
        {
          id: 'audit-snapshot-1',
          actor: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User' },
          actorLabel: 'Owner User',
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          resourceType: 'snapshot',
          resourceId: 'snapshot-1',
          resourceLabel: 'Before imports',
          action: 'created',
          actionLabel: 'saved snapshot',
          summary: 'Created snapshot Before imports',
          metadata: { snapshotName: 'Before imports' },
          createdAt: '2026-04-14T12:00:00.000Z',
          timeLabel: '12:00:00',
        },
      ],
      nextCursor: null,
      serverTime: '2026-04-14T12:00:05.000Z',
    });
    projectSnapshotsRepository.list.mockResolvedValue({
      items: [
        {
          id: 'snapshot-1',
          projectId: 'project-1',
          name: 'Before imports',
          description: '',
          createdAt: '2026-04-14T12:00:00.000Z',
          createdBy: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User', label: 'Owner User' },
        },
      ],
    });
    projectSnapshotsRepository.get.mockResolvedValue({
      id: 'snapshot-1',
      projectId: 'project-1',
      name: 'Before imports',
      description: '',
      createdAt: '2026-04-14T12:00:00.000Z',
      createdBy: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User', label: 'Owner User' },
      payload: {
        project: {
          id: 'project-1',
          slug: 'workspace-project',
          name: 'Workspace project',
          description: 'Live backend project',
        },
        globalConfig: {
          projectId: 'project-1',
          latencyEnabled: false,
          latencyMinMs: 0,
          latencyMaxMs: 1000,
          latencyMode: 'fixed',
          errorSimulationEnabled: false,
          errorSimulationRate: 0,
          errorSimulationCodes: [500],
          rateLimitingEnabled: false,
          rateLimitingRpm: 60,
          loggingLevel: 'basic',
          scope: 'all',
        },
        endpoints: [],
      },
    });
    projectSnapshotsRepository.restore.mockResolvedValue({ restoredSnapshotId: 'snapshot-1' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { component } = createComponent();
    await flushAsyncWork();

    component.selectNav('history');
    await flushAsyncWork();
    await (component as unknown as { createSnapshot(): void }).createSnapshot();
    await flushAsyncWork();
    await (component as unknown as { restoreSnapshot(snapshotId: string): Promise<void> }).restoreSnapshot(
      'snapshot-1',
    );
    await flushAsyncWork();

    expect(projectSnapshotsRepository.list).toHaveBeenCalledWith('project-1');
    expect(projectSnapshotsRepository.create).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({ name: expect.any(String) }),
    );
    expect(projectSnapshotsRepository.get).toHaveBeenCalledWith('project-1', 'snapshot-1');
    expect(projectSnapshotsRepository.restore).toHaveBeenCalledWith('project-1', 'snapshot-1');
    expect(confirmSpy).toHaveBeenCalled();
  });
});
