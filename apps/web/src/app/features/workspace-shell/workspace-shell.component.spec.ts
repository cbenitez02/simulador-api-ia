import { Injector, runInInjectionContext } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupAngularVitest } from '../../testing/angular-vitest';
import { EndpointsRepository } from '../endpoints/data-access/endpoints.repository';
import { GlobalConfigRepository } from '../global-config/data-access/global-config.repository';
import type { GlobalConfig } from '../global-config/models/global-config.model';
import { ProjectsRepository } from '../main-dashboard/data-access/projects.repository';
import type { DashboardProject } from '../main-dashboard/models/dashboard-project.model';
import type { EndpointPreview } from '../../shared/models/endpoint-preview.model';
import type { CreateProjectWithEndpointPayload } from '../../shared/ui/create-project-modal/create-project-modal.model';
import { WorkspaceShellComponent } from './workspace-shell.component';

setupAngularVitest();

type WritableSignalLike<T> = {
  (): T;
  set(value: T): void;
};

type WorkspaceShellTestApi = {
  projects: WritableSignalLike<DashboardProject[]>;
  projectsError: () => string | null;
  projectsLoading: () => boolean;
  selectedProjectId: WritableSignalLike<string>;
  globalConfig: WritableSignalLike<GlobalConfig>;
  globalConfigDrawerOpen: WritableSignalLike<boolean>;
  globalConfigError: () => string | null;
  globalConfigLoading: () => boolean;
  globalConfigSaving: () => boolean;
  retryLoadProjects(): void;
  editGlobalConfig(): void;
  onGlobalConfigSaved(config: GlobalConfig): void;
  onCreateProjectModalWithEndpoint(payload: CreateProjectWithEndpointPayload): void;
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
    },
  },
};

const projectFixture: DashboardProject = {
  id: 'project-1',
  name: 'Workspace project',
  mockUrl: 'https://mock.example.com/project-1',
  description: 'Live backend project',
  lastUpdatedRelative: 'just now',
  endpoints: [endpointFixture],
};

const normalizedConfigFixture: GlobalConfig = {
  latency: { enabled: true, minMs: 120, maxMs: 800, mode: 'random' },
  errorSimulation: { enabled: true, rate: 15, statusCodes: [400, 500] },
  rateLimiting: { enabled: false, requestsPerMinute: 100 },
  logging: { level: 'none' },
  scope: 'without-overrides',
};

describe('WorkspaceShellComponent', () => {
  const projectsRepository = {
    listProjects: vi.fn(),
    createProject: vi.fn(),
    getProject: vi.fn(),
  };

  const endpointsRepository = {
    saveEndpoint: vi.fn(),
    deleteEndpoint: vi.fn(),
  };

  const globalConfigRepository = {
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
  };

  function createComponent() {
    const injector = Injector.create({
      providers: [
        { provide: ProjectsRepository, useValue: projectsRepository },
        { provide: EndpointsRepository, useValue: endpointsRepository },
        { provide: GlobalConfigRepository, useValue: globalConfigRepository },
      ],
    });

    return runInInjectionContext(injector, () => new WorkspaceShellComponent()) as unknown as WorkspaceShellTestApi;
  }

  beforeEach(() => {
    projectsRepository.listProjects.mockReset();
    projectsRepository.createProject.mockReset();
    projectsRepository.getProject.mockReset();
    endpointsRepository.saveEndpoint.mockReset();
    endpointsRepository.deleteEndpoint.mockReset();
    globalConfigRepository.getConfig.mockReset();
    globalConfigRepository.saveConfig.mockReset();
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

  it('opens the config drawer with normalized values after loading backend config', async () => {
    projectsRepository.listProjects.mockResolvedValue([projectFixture]);
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
    expect(component.globalConfig().scope).toBe('without-overrides');
  });

  it('keeps the config drawer open and surfaces actionable feedback when save fails validation', async () => {
    projectsRepository.listProjects.mockResolvedValue([projectFixture]);
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

  it('creates a project and manual endpoint prompt without requiring any AI dependency', async () => {
    const createdProject: DashboardProject = {
      ...projectFixture,
      id: 'project-2',
      name: 'Manual API',
      endpoints: [],
    };

    projectsRepository.listProjects.mockResolvedValueOnce([]).mockResolvedValueOnce([createdProject]);
    projectsRepository.createProject.mockResolvedValue(createdProject);
    endpointsRepository.saveEndpoint.mockResolvedValue(endpointFixture);

    const component = createComponent();
    await flushAsyncWork();

    component.onCreateProjectModalWithEndpoint({
      name: 'Manual API',
      description: 'Created manually',
      endpointPrompt: 'POST /orders',
    });

    await flushAsyncWork(6);

    expect(projectsRepository.createProject).toHaveBeenCalledWith({
      name: 'Manual API',
      description: 'Created manually',
      endpointPrompt: 'POST /orders',
    });
    expect(endpointsRepository.saveEndpoint).toHaveBeenCalledWith(
      'project-2',
      expect.objectContaining({
        method: 'POST',
        route: '/orders',
        description: 'POST /orders',
      }),
    );
    expect(projectsRepository.listProjects).toHaveBeenCalledTimes(2);
    expect(component.selectedProjectId()).toBe('project-2');
  });
});
