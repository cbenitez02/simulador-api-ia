import { Injector, runInInjectionContext } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupAngularVitest } from '../../testing/angular-vitest';
import { EndpointsRepository } from '../endpoints/data-access/endpoints.repository';
import { GlobalConfigRepository } from '../global-config/data-access/global-config.repository';
import type { GlobalConfig } from '../global-config/models/global-config.model';
import { ProjectsRepository } from '../main-dashboard/data-access/projects.repository';
import type { DashboardProject } from '../main-dashboard/models/dashboard-project.model';
import type { EndpointPreview } from '../../shared/models/endpoint-preview.model';
import type {
  CreateProjectWithEndpointPayload,
  EditProjectModalPayload,
} from '../../shared/ui/create-project-modal/create-project-modal.model';
import type { ApiLogEntry } from '../logs/models/api-log.model';
import type { CreateProjectAiFlowState } from './models/workspace-shell.model';
import { WorkspaceShellComponent } from './workspace-shell.component';

setupAngularVitest();

type WritableSignalLike<T> = {
  (): T;
  set(value: T): void;
};

type WorkspaceShellTestApi = {
  projects: WritableSignalLike<DashboardProject[]>;
  activeProject: () => DashboardProject | null;
  projectsError: () => string | null;
  projectsLoading: () => boolean;
  selectedProjectId: WritableSignalLike<string>;
  selectedEndpointId: WritableSignalLike<string | null>;
  selectedLog: WritableSignalLike<ApiLogEntry | null>;
  activeNav: WritableSignalLike<'dashboard' | 'logs' | 'endpoints' | 'settings'>;
  globalConfig: WritableSignalLike<GlobalConfig>;
  globalConfigDrawerOpen: WritableSignalLike<boolean>;
  globalConfigError: () => string | null;
  globalConfigLoading: () => boolean;
  globalConfigSaving: () => boolean;
  createEndpointFlowOpen: WritableSignalLike<boolean>;
  createProjectModalOpen: WritableSignalLike<boolean>;
  createProjectModalLoading: () => boolean;
  createProjectError: () => string | null;
  createProjectPartialState: WritableSignalLike<CreateProjectAiFlowState | null>;
  editProjectModalOpen: WritableSignalLike<boolean>;
  editProjectModalLoading: () => boolean;
  editProjectError: () => string | null;
  deleteProjectDialogOpen: WritableSignalLike<boolean>;
  deleteProjectPending: () => boolean;
  deleteProjectError: () => string | null;
  retryLoadProjects(): void;
  editGlobalConfig(): void;
  openEditProjectModal(): void;
  onEditProjectModalSave(payload: EditProjectModalPayload): void;
  openDeleteProjectDialog(): void;
  closeDeleteProjectDialog(): void;
  confirmDeleteProject(): void;
  onGlobalConfigSaved(config: GlobalConfig): void;
  onCreateProjectModalWithEndpoint(payload: CreateProjectWithEndpointPayload): void;
  retryCreateProjectEndpointGeneration(): void;
  continueCreateProjectManually(): void;
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

const secondProjectFixture: DashboardProject = {
  id: 'project-2',
  name: 'Billing API',
  mockUrl: 'https://mock.example.com/project-2',
  description: 'Second project',
  lastUpdatedRelative: '1 minute ago',
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
  scope: 'without-overrides',
};

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
    projectsRepository.updateProject.mockReset();
    projectsRepository.deleteProject.mockReset();
    endpointsRepository.saveEndpoint.mockReset();
    endpointsRepository.generateAiEndpoint.mockReset();
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

  it('creates a project and generates the first endpoint through the AI backend flow', async () => {
    const createdProject: DashboardProject = {
      ...projectFixture,
      id: 'project-2',
      name: 'Manual API',
      endpoints: [],
    };

    projectsRepository.listProjects.mockResolvedValueOnce([]).mockResolvedValueOnce([createdProject]);
    projectsRepository.createProject.mockResolvedValue(createdProject);
    endpointsRepository.generateAiEndpoint.mockResolvedValue(endpointFixture);

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
    });
    expect(endpointsRepository.generateAiEndpoint).toHaveBeenCalledWith('project-2', 'POST /orders');
    expect(projectsRepository.listProjects).toHaveBeenCalledTimes(2);
    expect(component.selectedProjectId()).toBe('project-2');
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

    projectsRepository.listProjects.mockResolvedValueOnce([]).mockResolvedValueOnce([createdProject]);
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

  it('allows continuing manually after partial success without clearing the created project', async () => {
    projectsRepository.listProjects.mockResolvedValue([projectFixture]);

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
    expect(component.activeNav()).toBe('dashboard');
  });

  it('updates the active project and keeps it selected after a successful edit', async () => {
    const updatedProject: DashboardProject = {
      ...projectFixture,
      name: 'Renamed workspace',
      description: 'Fresh description',
    };

    projectsRepository.listProjects.mockResolvedValue([projectFixture]);
    projectsRepository.updateProject.mockResolvedValue(updatedProject);

    const component = createComponent();
    await flushAsyncWork();

    component.openEditProjectModal();
    expect(component.editProjectModalOpen()).toBe(true);

    component.onEditProjectModalSave({
      name: 'Renamed workspace',
      description: 'Fresh description',
    });

    await flushAsyncWork();

    expect(projectsRepository.updateProject).toHaveBeenCalledWith('project-1', {
      name: 'Renamed workspace',
      description: 'Fresh description',
    });
    expect(component.selectedProjectId()).toBe('project-1');
    expect(component.projects()[0]?.name).toBe('Renamed workspace');
    expect(component.editProjectModalOpen()).toBe(false);
  });

  it('prevents duplicate edit submissions while the repository update is pending', async () => {
    let resolveUpdate!: (value: DashboardProject) => void;
    const updatePromise = new Promise<DashboardProject>((resolve) => {
      resolveUpdate = resolve;
    });

    projectsRepository.listProjects.mockResolvedValue([projectFixture]);
    projectsRepository.updateProject.mockReturnValue(updatePromise);

    const component = createComponent();
    await flushAsyncWork();

    component.openEditProjectModal();
    component.onEditProjectModalSave({ name: 'Renamed workspace', description: 'Fresh description' });
    component.onEditProjectModalSave({ name: 'Renamed again', description: 'Second click' });

    expect(projectsRepository.updateProject).toHaveBeenCalledTimes(1);
    expect(component.editProjectModalLoading()).toBe(true);

    resolveUpdate({ ...projectFixture, name: 'Renamed workspace', description: 'Fresh description' });
    await flushAsyncWork();

    expect(component.editProjectModalLoading()).toBe(false);
  });

  it('keeps the edit modal open and shows actionable feedback when project update fails', async () => {
    projectsRepository.listProjects.mockResolvedValue([projectFixture]);
    projectsRepository.updateProject.mockRejectedValue(new Error('Name already exists in this workspace.'));

    const component = createComponent();
    await flushAsyncWork();

    component.openEditProjectModal();
    component.onEditProjectModalSave({ name: 'Duplicated', description: 'Fresh description' });

    await flushAsyncWork();

    expect(component.editProjectModalOpen()).toBe(true);
    expect(component.editProjectError()).toBe('Name already exists in this workspace.');
    expect(component.selectedProjectId()).toBe('project-1');
  });

  it('cleans project-scoped state and reselects another project after delete succeeds', async () => {
    projectsRepository.listProjects
      .mockResolvedValueOnce([projectFixture, secondProjectFixture])
      .mockResolvedValueOnce([secondProjectFixture]);
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
    projectsRepository.listProjects.mockResolvedValue([projectFixture, secondProjectFixture]);

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
    projectsRepository.listProjects.mockResolvedValueOnce([projectFixture]).mockResolvedValueOnce([]);
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
    projectsRepository.listProjects.mockResolvedValue([projectFixture]);
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
});
