import { Injector, runInInjectionContext } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupAngularVitest } from '../../testing/angular-vitest';
import { ApiClient } from '../../shared/http/api-client';
import { ApiError } from '../../shared/http/api-error.mapper';
import type { ApiLogEntry } from '../logs/models/api-log.model';
import { LogsRepository } from '../logs/data-access/logs.repository';
import { ProjectsRepository } from '../main-dashboard/data-access/projects.repository';
import { EndpointsRepository } from '../endpoints/data-access/endpoints.repository';
import { GlobalConfigRepository } from '../global-config/data-access/global-config.repository';
import { WorkspaceShellComponent } from './workspace-shell.component';

setupAngularVitest();

type WorkspaceShellHarness = WorkspaceShellComponent & {
  projects: () => Array<{ name: string; description: string; mockUrl: string; endpoints: Array<{ path: string }> }>;
  activeNav: {
    (): 'dashboard' | 'logs' | 'endpoints' | 'settings';
    set(value: 'dashboard' | 'logs' | 'endpoints' | 'settings'): void;
  };
  selectedProjectId: () => string;
  selectedEndpointId: () => string | null;
  createProjectModalOpen: () => boolean;
  createProjectError: () => string | null;
  createProjectPartialState: () => { createdProjectId: string; endpointPrompt: string } | null;
  selectedLog: { (): ApiLogEntry | null; set(value: ApiLogEntry | null): void };
  selectNav(value: 'dashboard' | 'logs' | 'endpoints' | 'settings'): void;
  activeProject: () => {
    name: string;
    description: string;
    mockUrl: string;
    endpoints: Array<{ path: string }>;
  } | null;
  hasProjects: () => boolean;
  onCreateProjectModalWithEndpoint(payload: { name: string; description: string; endpointPrompt: string }): void;
  retryCreateProjectEndpointGeneration(): void;
};

async function flushAsyncWork(cycles = 6): Promise<void> {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
}

async function renderSnapshot(component: WorkspaceShellHarness, logsRepository: LogsRepository): Promise<string> {
  const content: string[] = [];

  if (component.activeNav() === 'dashboard' && component.activeProject()) {
    const project = component.activeProject()!;
    content.push(project.name, project.description, project.mockUrl, `${project.endpoints.length} endpoints`);
    for (const endpoint of project.endpoints) content.push(endpoint.path);
  }

  if (component.activeNav() === 'logs' && component.hasProjects()) {
    content.push('Logs');
    const logs = await logsRepository.listLogs(component.selectedProjectId());

    if (logs.length === 0) {
      content.push('No logs yet for this project.');
    } else {
      for (const entry of logs) content.push(entry.path, String(entry.statusCode));
    }
  }

  const selectedLog = component.selectedLog();
  if (component.activeNav() === 'logs' && selectedLog) {
    content.push(
      'Inspector',
      selectedLog.fullUrl,
      `Scenario '${selectedLog.scenario}' selected from ${selectedLog.scenarioSelectionSource} probability rules.`,
      ...Object.keys(selectedLog.responseHeaders),
    );
  }

  return content.join(' | ');
}

describe('WorkspaceShellComponent integration', () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
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

  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.patch.mockReset();
    api.delete.mockReset();
    endpointsRepository.saveEndpoint.mockReset();
    endpointsRepository.generateAiEndpoint.mockReset();
    endpointsRepository.deleteEndpoint.mockReset();
    globalConfigRepository.getConfig.mockReset();
    globalConfigRepository.saveConfig.mockReset();
  });

  function createComponent() {
    const injector = Injector.create({
      providers: [
        ProjectsRepository,
        LogsRepository,
        { provide: ApiClient, useValue: api },
        { provide: EndpointsRepository, useValue: endpointsRepository },
        { provide: GlobalConfigRepository, useValue: globalConfigRepository },
      ],
    });

    const component = runInInjectionContext(
      injector,
      () => new WorkspaceShellComponent(),
    ) as unknown as WorkspaceShellHarness;
    const logsRepository = injector.get(LogsRepository);
    return { component, logsRepository };
  }

  it('renders backend projects in the dashboard and selects the first project automatically', async () => {
    api.get.mockImplementation(async (path: string) => {
      if (path === '/projects') {
        return [
          {
            id: 'p1',
            name: 'Workspace project',
            slug: 'workspace-project',
            description: 'Live backend project',
            updatedAt: new Date().toISOString(),
            _count: { endpoints: 1 },
          },
        ];
      }

      if (path === '/projects/p1/endpoints') {
        return [
          {
            id: 'e1',
            projectId: 'p1',
            method: 'GET',
            path: '/users',
            description: 'List users',
            statusCode: 200,
            responseBody: [{ id: 1 }],
            endpointConfig: {
              endpointId: 'e1',
              latencyMode: 'fixed',
              fixedDelayMs: 120,
              minDelayMs: 0,
              maxDelayMs: 500,
              errorRate: 0,
              useScenarioWeights: true,
            },
            scenarios: [
              {
                id: 's1',
                endpointId: 'e1',
                name: 'Success',
                type: 'success',
                statusCode: 200,
                body: [{ id: 1 }],
                delayMs: 120,
                weight: 100,
              },
            ],
          },
        ];
      }

      throw new Error(`Unexpected GET ${path}`);
    });

    const { component, logsRepository } = createComponent();
    await flushAsyncWork();

    const content = await renderSnapshot(component, logsRepository);
    expect(api.get).toHaveBeenCalledWith('/projects');
    expect(api.get).toHaveBeenCalledWith('/projects/p1/endpoints');
    expect(content).toContain('Workspace project');
    expect(content).toContain('Live backend project');
    expect(content).toContain('http://localhost:3000/mock/workspace-project');
    expect(content).toContain('1 endpoints');
    expect(content).toContain('/users');
  });

  it('renders backend logs and shows the detail sidebar after selecting a log entry', async () => {
    api.get.mockImplementation(async (path: string) => {
      if (path === '/projects') {
        return [
          {
            id: 'p1',
            name: 'Workspace project',
            slug: 'workspace-project',
            description: 'Live backend project',
            updatedAt: new Date().toISOString(),
            _count: { endpoints: 1 },
          },
        ];
      }

      if (path === '/projects/p1/endpoints') return [];

      if (path === '/projects/p1/logs') {
        return [
          {
            id: 'log-1',
            projectId: 'p1',
            method: 'POST',
            path: '/users',
            fullUrl: 'https://mock.example.com/users',
            statusCode: 201,
            latencyMs: 84,
            scenarioType: 'success',
            scenarioSelectionSource: 'weighted',
            requestHeaders: { 'content-type': 'application/json' },
            requestBody: { name: 'Ada' },
            responseHeaders: { 'x-mock': 'true' },
            responseBody: { ok: true },
            createdAt: '2026-04-04T10:11:12.000Z',
          },
        ];
      }

      throw new Error(`Unexpected GET ${path}`);
    });

    const { component, logsRepository } = createComponent();
    await flushAsyncWork();

    component.selectNav('logs');
    const logs = await logsRepository.listLogs(component.selectedProjectId());
    component.selectedLog.set(logs[0] ?? null);

    const content = await renderSnapshot(component, logsRepository);
    expect(content).toContain('Logs');
    expect(content).toContain('/users');
    expect(content).toContain('201');
    expect(content).toContain('Inspector');
    expect(content).toContain('https://mock.example.com/users');
    expect(content).toContain("Scenario 'success' selected from weighted probability rules.");
    expect(content).toContain('x-mock');
  });

  it('shows an empty state when the selected project has no logs', async () => {
    api.get.mockImplementation(async (path: string) => {
      if (path === '/projects') {
        return [
          {
            id: 'p1',
            name: 'Workspace project',
            slug: 'workspace-project',
            description: 'Live backend project',
            updatedAt: new Date().toISOString(),
            _count: { endpoints: 0 },
          },
        ];
      }

      if (path === '/projects/p1/endpoints') return [];
      if (path === '/projects/p1/logs') return [];

      throw new Error(`Unexpected GET ${path}`);
    });

    const { component, logsRepository } = createComponent();
    await flushAsyncWork();

    component.selectNav('logs');
    const content = await renderSnapshot(component, logsRepository);
    expect(content).toContain('No logs yet for this project.');
  });

  it('creates the project first, generates the first endpoint, and opens it on full success', async () => {
    api.get
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'p1',
          name: 'Generated project',
          slug: 'generated-project',
          description: 'AI assisted workspace',
          updatedAt: new Date().toISOString(),
          _count: { endpoints: 1 },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'e1',
          projectId: 'p1',
          method: 'POST',
          path: '/users',
          description: 'Create user',
          statusCode: 201,
          responseBody: { id: 'u1' },
          endpointConfig: null,
          scenarios: [],
        },
      ]);
    api.post.mockResolvedValueOnce({
      id: 'p1',
      name: 'Generated project',
      slug: 'generated-project',
      description: 'AI assisted workspace',
      updatedAt: new Date().toISOString(),
      _count: { endpoints: 0 },
    });
    endpointsRepository.generateAiEndpoint.mockResolvedValue({
      id: 'e1',
      method: 'POST',
      path: '/users',
      description: 'Create user',
      latencyMs: 120,
      statusCode: 201,
      responseBody: { id: 'u1' },
    });

    const { component } = createComponent();
    await flushAsyncWork();

    component.onCreateProjectModalWithEndpoint({
      name: 'Generated project',
      description: 'AI assisted workspace',
      endpointPrompt: 'Create a users endpoint',
    });

    await flushAsyncWork(14);

    expect(api.post).toHaveBeenCalledWith('/projects', {
      name: 'Generated project',
      description: 'AI assisted workspace',
    });
    expect(endpointsRepository.generateAiEndpoint).toHaveBeenCalledWith('p1', 'Create a users endpoint');
    expect(component.selectedProjectId()).toBe('p1');
    expect(component.selectedEndpointId()).toBe('e1');
    expect(component.activeNav()).toBe('endpoints');
    expect(component.createProjectModalOpen()).toBe(false);
    expect(component.createProjectPartialState()).toBeNull();
  });

  it('keeps the created project usable after partial success and retries generation without duplicating the project', async () => {
    api.get
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'p1',
          name: 'Generated project',
          slug: 'generated-project',
          description: 'AI assisted workspace',
          updatedAt: new Date().toISOString(),
          _count: { endpoints: 0 },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'p1',
          name: 'Generated project',
          slug: 'generated-project',
          description: 'AI assisted workspace',
          updatedAt: new Date().toISOString(),
          _count: { endpoints: 1 },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'e1',
          projectId: 'p1',
          method: 'POST',
          path: '/users',
          description: 'Create user',
          statusCode: 201,
          responseBody: { id: 'u1' },
          endpointConfig: null,
          scenarios: [],
        },
      ]);
    api.post.mockResolvedValueOnce({
      id: 'p1',
      name: 'Generated project',
      slug: 'generated-project',
      description: 'AI assisted workspace',
      updatedAt: new Date().toISOString(),
      _count: { endpoints: 0 },
    });
    endpointsRepository.generateAiEndpoint
      .mockRejectedValueOnce(new Error('AI request timed out'))
      .mockResolvedValueOnce({
        id: 'e1',
        method: 'POST',
        path: '/users',
        description: 'Create user',
        latencyMs: 120,
        statusCode: 201,
        responseBody: { id: 'u1' },
      });

    const { component } = createComponent();
    await flushAsyncWork();

    component.onCreateProjectModalWithEndpoint({
      name: 'Generated project',
      description: 'AI assisted workspace',
      endpointPrompt: 'Create a users endpoint',
    });

    await flushAsyncWork(14);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(component.selectedProjectId()).toBe('p1');
    expect(component.createProjectModalOpen()).toBe(true);
    expect(component.createProjectError()).toContain('first endpoint was not created');
    expect(component.createProjectPartialState()).toMatchObject({
      createdProjectId: 'p1',
      endpointPrompt: 'Create a users endpoint',
    });

    component.retryCreateProjectEndpointGeneration();
    await flushAsyncWork(14);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(endpointsRepository.generateAiEndpoint).toHaveBeenCalledTimes(2);
    expect(endpointsRepository.generateAiEndpoint).toHaveBeenNthCalledWith(1, 'p1', 'Create a users endpoint');
    expect(endpointsRepository.generateAiEndpoint).toHaveBeenNthCalledWith(2, 'p1', 'Create a users endpoint');
    expect(component.selectedEndpointId()).toBe('e1');
    expect(component.createProjectModalOpen()).toBe(false);
    expect(component.createProjectPartialState()).toBeNull();
  });

  it('surfaces unavailable-now fallback copy when create-project generation fails due to missing OpenAI config', async () => {
    api.get
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'p1',
          name: 'Generated project',
          slug: 'generated-project',
          description: 'AI assisted workspace',
          updatedAt: new Date().toISOString(),
          _count: { endpoints: 0 },
        },
      ])
      .mockResolvedValueOnce([]);
    api.post.mockResolvedValueOnce({
      id: 'p1',
      name: 'Generated project',
      slug: 'generated-project',
      description: 'AI assisted workspace',
      updatedAt: new Date().toISOString(),
      _count: { endpoints: 0 },
    });
    endpointsRepository.generateAiEndpoint.mockRejectedValueOnce(
      new ApiError(503, 'AI is unavailable right now', 'OPENAI_API_KEY is not configured', 'AI_UNAVAILABLE', false),
    );

    const { component } = createComponent();
    await flushAsyncWork();

    component.onCreateProjectModalWithEndpoint({
      name: 'Generated project',
      description: 'AI assisted workspace',
      endpointPrompt: 'Create a users endpoint',
    });

    await flushAsyncWork(14);

    expect(component.selectedProjectId()).toBe('p1');
    expect(component.createProjectModalOpen()).toBe(true);
    expect(component.createProjectError()).toBe(
      'Your project is ready, but AI is unavailable right now. Retry generation or continue manually.',
    );
    expect(component.createProjectPartialState()).toMatchObject({
      createdProjectId: 'p1',
      message: 'Your project is ready, but AI is unavailable right now. Retry generation or continue manually.',
    });
  });
});
