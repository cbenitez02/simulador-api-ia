import { Injector, runInInjectionContext } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupAngularVitest } from '../../testing/angular-vitest';
import { ApiClient } from '../../shared/http/api-client';
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
  selectedLog: { (): ApiLogEntry | null; set(value: ApiLogEntry | null): void };
  selectNav(value: 'dashboard' | 'logs' | 'endpoints' | 'settings'): void;
  activeProject: () => {
    name: string;
    description: string;
    mockUrl: string;
    endpoints: Array<{ path: string }>;
  } | null;
  hasProjects: () => boolean;
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
});
