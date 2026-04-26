import { setupAngularVitest } from '../../../testing/angular-vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../../shared/http/api-client';
import type { EndpointSaveError } from './endpoints.repository';
import { EndpointsRepository } from './endpoints.repository';

setupAngularVitest();

describe('EndpointsRepository', () => {
  function createRepository(api: object) {
    const injector = Injector.create({
      providers: [{ provide: ApiClient, useValue: api }],
    });

    return runInInjectionContext(injector, () => new EndpointsRepository());
  }

  it('orchestrates endpoint save, config upsert, scenario reconciliation, and detail refresh', async () => {
    const api = {
      post: vi.fn(async (path: string) => {
        if (path === '/projects/p1/endpoints') {
          return {
            id: 'e1',
            projectId: 'p1',
            method: 'POST',
            path: '/users',
            description: '',
            statusCode: 201,
            responseBody: { ok: true },
          };
        }

        return { id: 'new-scenario' };
      }),
      put: vi.fn(async () => ({})),
      get: vi.fn(async (path: string) => {
        if (path === '/endpoints/e1/scenarios') return [];
        if (path === '/projects/p1/endpoints/e1') {
          return {
            id: 'e1',
            projectId: 'p1',
            method: 'POST',
            path: '/users',
            description: 'Create user',
            statusCode: 201,
            responseBody: { ok: true },
            endpointConfig: {
              endpointId: 'e1',
              latencyMode: 'fixed',
              fixedDelayMs: 100,
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
                statusCode: 201,
                body: { ok: true },
                delayMs: 100,
                weight: 100,
              },
            ],
          };
        }

        throw new Error(`Unexpected path: ${path}`);
      }),
      patch: vi.fn(async () => ({})),
      delete: vi.fn(async () => undefined),
    };

    const repository = createRepository(api);
    const result = await repository.saveEndpoint('p1', {
      method: 'POST',
      route: '/users',
      description: 'Create user',
      statusCode: 201,
      responseBody: { ok: true },
      behavior: {
        latencyMode: 'fixed',
        fixedDelayMs: 100,
        minDelayMs: 0,
        maxDelayMs: 500,
        errorRate: 0,
        useScenarioWeights: true,
      },
      scenarios: [
        {
          id: 'local-success',
          name: 'Success',
          type: 'success',
          statusCode: 201,
          body: { ok: true },
          delayMs: 100,
          weight: 100,
        },
      ],
      locks: { method: false, path: false, scenarioType: false },
      source: 'manual',
    });

    expect(api.post).toHaveBeenCalledWith('/projects/p1/endpoints', expect.any(Object));
    expect(api.put).toHaveBeenCalledWith('/endpoints/e1/config', expect.any(Object));
    expect(api.post).toHaveBeenCalledWith('/endpoints/e1/scenarios', expect.any(Object));
    expect(result.id).toBe('e1');
  });

  it('loads paged endpoint summaries with server-side filters', async () => {
    const api = {
      get: vi.fn(async (path: string) => {
        if (path === '/projects/p1/endpoints?limit=25&offset=0&q=user&method=GET&sort=method') {
          return {
            items: [
              {
                id: 'e1',
                projectId: 'p1',
                method: 'GET',
                path: '/users',
                description: 'List users',
                statusCode: 200,
                responseBody: { data: [{ id: 'u1' }] },
                responseHeaders: { 'content-type': 'application/json' },
                updatedAt: new Date().toISOString(),
                scenarioCount: 2,
                latencyMs: 120,
              },
            ],
            page: { limit: 25, offset: 0, total: 1, hasMore: false },
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const repository = createRepository(api);
    const result = await repository.listEndpoints('p1', {
      limit: 25,
      offset: 0,
      q: 'user',
      method: 'GET',
      sort: 'method',
    });

    expect(api.get).toHaveBeenCalledWith('/projects/p1/endpoints?limit=25&offset=0&q=user&method=GET&sort=method');
    expect(result.page.total).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'e1',
        method: 'GET',
        path: '/users',
        latencyMs: 120,
        statusCode: 200,
        responseBody: { data: [{ id: 'u1' }] },
        responseHeaders: { 'content-type': 'application/json' },
      }),
    ]);
  });

  it('updates existing endpoints and reconciles create-update-delete scenario operations', async () => {
    const api = {
      post: vi.fn(async () => ({ id: 'created-scenario' })),
      put: vi.fn(async () => ({})),
      get: vi.fn(async (path: string) => {
        if (path === '/endpoints/e1/scenarios') {
          return [
            {
              id: 's1',
              endpointId: 'e1',
              name: 'Existing success',
              type: 'success',
              statusCode: 200,
              body: { ok: true },
              delayMs: 50,
              weight: 70,
            },
            {
              id: 's-obsolete',
              endpointId: 'e1',
              name: 'Obsolete',
              type: 'error',
              statusCode: 500,
              body: { error: true },
              delayMs: 0,
              weight: 30,
            },
          ];
        }

        if (path === '/projects/p1/endpoints/e1') {
          return {
            id: 'e1',
            projectId: 'p1',
            method: 'PATCH',
            path: '/users/:id',
            description: 'Update user',
            statusCode: 200,
            responseBody: { ok: true },
            endpointConfig: {
              endpointId: 'e1',
              latencyMode: 'range',
              fixedDelayMs: 0,
              minDelayMs: 50,
              maxDelayMs: 250,
              errorRate: 0.15,
              useScenarioWeights: false,
            },
            scenarios: [
              {
                id: 's1',
                endpointId: 'e1',
                name: 'Existing success',
                type: 'success',
                statusCode: 200,
                body: { ok: true },
                delayMs: 50,
                weight: 70,
              },
              {
                id: 'created-scenario',
                endpointId: 'e1',
                name: 'Timeout',
                type: 'timeout',
                statusCode: 408,
                body: { error: 'timeout' },
                delayMs: 5000,
                weight: 30,
              },
            ],
          };
        }

        throw new Error(`Unexpected path: ${path}`);
      }),
      patch: vi.fn(async (path: string) => {
        if (path === '/projects/p1/endpoints/e1') {
          return {
            id: 'e1',
            projectId: 'p1',
            method: 'PATCH',
            path: '/users/:id',
            description: 'Update user',
            statusCode: 200,
            responseBody: { ok: true },
          };
        }

        return {};
      }),
      delete: vi.fn(async () => undefined),
    };

    const repository = createRepository(api);

    const result = await repository.saveEndpoint(
      'p1',
      {
        method: 'PATCH',
        route: '/users/:id',
        description: 'Update user',
        statusCode: 200,
        responseBody: { ok: true },
        behavior: {
          latencyMode: 'range',
          fixedDelayMs: 0,
          minDelayMs: 50,
          maxDelayMs: 250,
          errorRate: 15,
          useScenarioWeights: false,
        },
        scenarios: [
          {
            id: 's1',
            name: 'Existing success',
            type: 'success',
            statusCode: 200,
            body: { ok: true },
            delayMs: 50,
            weight: 70,
          },
          {
            id: 'draft-timeout',
            name: 'Timeout',
            type: 'timeout',
            statusCode: 408,
            body: { error: 'timeout' },
            delayMs: 5000,
            weight: 30,
          },
        ],
        locks: { method: false, path: false, scenarioType: false },
        source: 'existing',
      },
      'e1',
    );

    expect(api.patch).toHaveBeenCalledWith('/projects/p1/endpoints/e1', expect.any(Object));
    expect(api.put).toHaveBeenCalledWith('/endpoints/e1/config', expect.objectContaining({ errorRate: 0 }));
    expect(api.post).toHaveBeenCalledWith('/endpoints/e1/scenarios', expect.objectContaining({ name: 'Timeout' }));
    expect(api.delete).toHaveBeenCalledWith('/endpoints/e1/scenarios/s-obsolete');
    expect(api.patch).not.toHaveBeenCalledWith('/endpoints/e1/scenarios/s1', expect.anything());
    expect(result.id).toBe('e1');
    expect(result.config?.errorRatePct).toBe(0);
  });

  it('patches existing scenarios only when their persisted payload actually changed', async () => {
    const api = {
      post: vi.fn(async () => ({ id: 'created-scenario' })),
      put: vi.fn(async () => ({})),
      get: vi.fn(async (path: string) => {
        if (path === '/endpoints/e1/scenarios') {
          return [
            {
              id: 's1',
              endpointId: 'e1',
              name: 'Existing success',
              type: 'success',
              statusCode: 200,
              body: { ok: true },
              delayMs: 50,
              weight: 70,
            },
          ];
        }

        if (path === '/projects/p1/endpoints/e1') {
          return {
            id: 'e1',
            projectId: 'p1',
            method: 'PATCH',
            path: '/users/:id',
            description: 'Update user',
            statusCode: 200,
            responseBody: { ok: true },
            endpointConfig: {
              endpointId: 'e1',
              latencyMode: 'range',
              fixedDelayMs: 0,
              minDelayMs: 50,
              maxDelayMs: 250,
              errorRate: 0,
              useScenarioWeights: false,
            },
            scenarios: [
              {
                id: 's1',
                endpointId: 'e1',
                name: 'Existing success renamed',
                type: 'success',
                statusCode: 200,
                body: { ok: true },
                delayMs: 50,
                weight: 70,
              },
            ],
          };
        }

        throw new Error(`Unexpected path: ${path}`);
      }),
      patch: vi.fn(async (path: string) => {
        if (path === '/projects/p1/endpoints/e1') {
          return {
            id: 'e1',
            projectId: 'p1',
            method: 'PATCH',
            path: '/users/:id',
            description: 'Update user',
            statusCode: 200,
            responseBody: { ok: true },
          };
        }

        return {};
      }),
      delete: vi.fn(async () => undefined),
    };

    const repository = createRepository(api);

    await repository.saveEndpoint(
      'p1',
      {
        method: 'PATCH',
        route: '/users/:id',
        description: 'Update user',
        statusCode: 200,
        responseBody: { ok: true },
        behavior: {
          latencyMode: 'range',
          fixedDelayMs: 0,
          minDelayMs: 50,
          maxDelayMs: 250,
          errorRate: 15,
          useScenarioWeights: false,
        },
        scenarios: [
          {
            id: 's1',
            name: 'Existing success renamed',
            type: 'success',
            statusCode: 200,
            body: { ok: true },
            delayMs: 50,
            weight: 70,
          },
        ],
        locks: { method: false, path: false, scenarioType: false },
        source: 'existing',
      },
      'e1',
    );

    expect(api.patch).toHaveBeenCalledWith(
      '/endpoints/e1/scenarios/s1',
      expect.objectContaining({ name: 'Existing success renamed' }),
    );
  });

  it('surfaces config-stage partial failures with persisted endpoint metadata and skips refresh', async () => {
    const api = {
      post: vi.fn(async (path: string) => {
        if (path === '/projects/p1/endpoints') {
          return {
            id: 'e1',
            projectId: 'p1',
            method: 'POST',
            path: '/users',
            description: 'Create user',
            statusCode: 201,
            responseBody: { ok: true },
          };
        }

        return { id: 'new-scenario' };
      }),
      put: vi.fn(async () => {
        throw new Error('Config persistence failed');
      }),
      get: vi.fn(async (path: string) => {
        if (path === '/projects/p1/endpoints/e1') {
          throw new Error('Detail refresh must not run after partial failure');
        }

        return [];
      }),
      patch: vi.fn(async () => ({})),
      delete: vi.fn(async () => undefined),
    };

    const repository = createRepository(api);

    await expect(
      repository.saveEndpoint('p1', {
        method: 'POST',
        route: '/users',
        description: 'Create user',
        statusCode: 201,
        responseBody: { ok: true },
        behavior: {
          latencyMode: 'fixed',
          fixedDelayMs: 100,
          minDelayMs: 0,
          maxDelayMs: 500,
          errorRate: 0,
          useScenarioWeights: true,
        },
        scenarios: [],
        locks: { method: false, path: false, scenarioType: false },
        source: 'manual',
      }),
    ).rejects.toMatchObject({
      message: 'Config persistence failed',
      stage: 'config',
      endpointId: 'e1',
      partial: true,
    } satisfies Partial<EndpointSaveError>);

    expect(api.put).toHaveBeenCalledWith('/endpoints/e1/config', expect.any(Object));
    expect(api.get).not.toHaveBeenCalledWith('/projects/p1/endpoints/e1');
  });

  it('surfaces refresh-stage partial failures after config and scenarios succeed', async () => {
    const api = {
      post: vi.fn(async (path: string) => {
        if (path === '/projects/p1/endpoints') {
          return {
            id: 'e1',
            projectId: 'p1',
            method: 'POST',
            path: '/users',
            description: 'Create user',
            statusCode: 201,
            responseBody: { ok: true },
          };
        }

        return { id: 'new-scenario' };
      }),
      put: vi.fn(async () => ({})),
      get: vi.fn(async (path: string) => {
        if (path === '/endpoints/e1/scenarios') return [];
        throw new Error('Detail refresh failed');
      }),
      patch: vi.fn(async () => ({})),
      delete: vi.fn(async () => undefined),
    };

    const repository = createRepository(api);

    await expect(
      repository.saveEndpoint('p1', {
        method: 'POST',
        route: '/users',
        description: 'Create user',
        statusCode: 201,
        responseBody: { ok: true },
        behavior: {
          latencyMode: 'fixed',
          fixedDelayMs: 100,
          minDelayMs: 0,
          maxDelayMs: 500,
          errorRate: 0,
          useScenarioWeights: true,
        },
        scenarios: [],
        locks: { method: false, path: false, scenarioType: false },
        source: 'manual',
      }),
    ).rejects.toMatchObject({
      message: 'Detail refresh failed',
      stage: 'refresh',
      endpointId: 'e1',
      partial: true,
    } satisfies Partial<EndpointSaveError>);

    expect(api.put).toHaveBeenCalledWith('/endpoints/e1/config', expect.any(Object));
    expect(api.get).toHaveBeenCalledWith('/projects/p1/endpoints/e1');
  });

  it('hydrates edit drafts with defaults when related config or scenarios are missing', async () => {
    const api = {
      get: vi.fn(async () => ({
        id: 'e1',
        projectId: 'p1',
        method: 'PUT',
        path: '/users/1',
        description: 'Replace user',
        statusCode: 200,
        responseBody: { ok: true },
        endpointConfig: null,
        scenarios: [],
      })),
    };

    const repository = createRepository(api);

    const draft = await repository.loadDraft('p1', 'e1');

    expect(api.get).toHaveBeenCalledWith('/projects/p1/endpoints/e1');
    expect(draft.behavior).toEqual({
      latencyMode: 'fixed',
      fixedDelayMs: 0,
      minDelayMs: 0,
      maxDelayMs: 500,
      errorRate: 0,
      useScenarioWeights: true,
    });
    expect(draft.scenarios).toHaveLength(1);
    expect(draft.scenarios[0]).toMatchObject({
      name: 'Success',
      type: 'success',
      statusCode: 200,
      body: { ok: true },
      delayMs: 0,
      weight: 100,
    });
  });

  it('requests ai preview drafts with the shared backend contract', async () => {
    const api = {
      post: vi.fn(async (path: string, body: unknown) => {
        if (path !== '/projects/p1/endpoints/ai-preview') {
          throw new Error(`Unexpected POST ${path}`);
        }

        expect(body).toEqual({ prompt: 'Create a user endpoint with success and empty scenarios' });

        return {
          method: 'POST',
          path: '/users',
          description: 'Create user',
          statusCode: 201,
          responseBody: { id: 'u1' },
          locks: { method: true, path: true, scenarioType: true },
          scenarios: [
            {
              name: 'Success',
              type: 'success',
              statusCode: 201,
              body: { id: 'u1' },
              delayMs: 120,
              weight: 80,
            },
          ],
        };
      }),
      get: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const repository = createRepository(api);
    const draft = await repository.previewAiDraft('p1', 'Create a user endpoint with success and empty scenarios');

    expect(api.post).toHaveBeenCalledWith('/projects/p1/endpoints/ai-preview', {
      prompt: 'Create a user endpoint with success and empty scenarios',
    });
    expect(draft.route).toBe('/users');
    expect(draft.locks).toEqual({ method: true, path: true, scenarioType: true });
    expect(draft.source).toBe('ai-preview');
  });
});
