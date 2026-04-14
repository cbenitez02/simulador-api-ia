import { setupAngularVitest } from '../../../testing/angular-vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../../shared/http/api-client';
import { ProjectsRepository } from './projects.repository';

const projectDto = {
  id: 'p1',
  name: 'Users',
  slug: 'users',
  description: '',
  updatedAt: new Date().toISOString(),
  _count: { endpoints: 1 },
};

const dashboardSummaryDto = {
  project: {
    id: 'p1',
    name: 'Users',
    description: '',
    slug: 'users',
    mockUrl: 'https://mock.example.com/users',
    updatedAt: new Date().toISOString(),
    status: 'running' as const,
  },
  metrics: {
    totalEndpoints: 1,
    totalScenarios: 2,
    avgLatencyMs: 120,
    errorRatePct: 5,
    totalRequests: 10,
  },
  health: {
    readyEndpoints: 1,
    needsAttentionEndpoints: 0,
    errorScenarioEndpoints: 1,
    emptyScenarioEndpoints: 0,
    timeoutScenarioEndpoints: 0,
  },
  endpointRows: [
    {
      endpointId: 'e1',
      method: 'GET',
      path: '/users',
      description: 'List users',
      scenarioCount: 2,
      latencyMs: 120,
      errorRatePct: 5,
      status: 'ready' as const,
    },
  ],
  recentRequests: [],
  configSummary: {
    latency: { enabled: false, mode: 'fixed' as const, minMs: 0, maxMs: 1000 },
    errorSimulation: { enabled: false, ratePct: 0, codes: [500] },
    rateLimiting: { enabled: false, rpm: 60 },
    logging: { level: 'basic' as const },
    scope: 'all' as const,
  },
};

setupAngularVitest();

describe('ProjectsRepository', () => {
  function createRepository(api: object) {
    const injector = Injector.create({
      providers: [{ provide: ApiClient, useValue: api }],
    });

    return runInInjectionContext(injector, () => new ProjectsRepository());
  }

  it('loads projects without endpoint fan-out and keeps placeholder counts for the sidebar list', async () => {
    const api = {
      get: vi.fn(async (path: string) => {
        if (path === '/projects?limit=25') {
          return { items: [projectDto], page: { limit: 25, offset: 0, total: 1, hasMore: false } };
        }
        throw new Error(`Unexpected GET ${path}`);
      }),
    };

    const repository = createRepository(api);
    const result = await repository.listProjects({ limit: 25 });

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/projects?limit=25');
    expect(result.page.total).toBe(1);
    expect(result.items[0]?.metrics.totalEndpoints).toBe(1);
    expect(result.items[0]?.endpointRows).toHaveLength(1);
    expect(result.items[0]?.endpoints).toHaveLength(1);
    expect(result.items[0]?.endpoints[0]?.path).toBe('Endpoint 1');
  });

  it('passes pagination offset and search query when requesting additional project pages', async () => {
    const api = {
      get: vi.fn(async (path: string) => {
        if (path === '/projects?limit=25&offset=25&q=billing') {
          return { items: [projectDto], page: { limit: 25, offset: 25, total: 26, hasMore: false } };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
    };

    const repository = createRepository(api);
    const result = await repository.listProjects({ limit: 25, offset: 25, q: ' billing ' });

    expect(api.get).toHaveBeenCalledWith('/projects?limit=25&offset=25&q=billing');
    expect(result.page.offset).toBe(25);
  });

  it('updates a project with a partial payload and remaps the refreshed project', async () => {
    const api = {
      get: vi.fn(async () => ({
        ...dashboardSummaryDto,
        project: { ...dashboardSummaryDto.project, name: 'Users v2', description: 'Updated description' },
      })),
      patch: vi.fn(async () => ({
        ...projectDto,
        name: 'Users v2',
        description: 'Updated description',
      })),
    };

    const repository = createRepository(api);
    const result = await repository.updateProject('p1', { name: 'Users v2' });

    expect(api.patch).toHaveBeenCalledWith('/projects/p1', { name: 'Users v2' });
    expect(api.get).toHaveBeenCalledWith('/projects/p1/dashboard-summary');
    expect(result.name).toBe('Users v2');
    expect(result.metrics.totalScenarios).toBe(2);
    expect(result.mockUrl).toBe('https://mock.example.com/users');
  });

  it('loads dashboard detail from the summary endpoint without endpoint fan-out', async () => {
    const api = {
      get: vi.fn(async () => dashboardSummaryDto),
    };

    const repository = createRepository(api);
    const result = await repository.getProject('p1');

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/projects/p1/dashboard-summary');
    expect(result.endpointRows).toHaveLength(1);
    expect(result.endpoints[0]?.path).toBe('/users');
  });

  it('deletes a project through the backend endpoint', async () => {
    const api = {
      delete: vi.fn(async () => undefined),
    };

    const repository = createRepository(api);
    await repository.deleteProject('p1');

    expect(api.delete).toHaveBeenCalledWith('/projects/p1');
  });
});
