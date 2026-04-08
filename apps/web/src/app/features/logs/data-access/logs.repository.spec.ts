import { setupAngularVitest } from '../../../testing/angular-vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../../shared/http/api-client';
import { LogsRepository } from './logs.repository';

setupAngularVitest();

describe('LogsRepository', () => {
  function createRepository(api: object) {
    const injector = Injector.create({
      providers: [{ provide: ApiClient, useValue: api }],
    });

    return runInInjectionContext(injector, () => new LogsRepository());
  }

  it('maps backend logs and supports empty results', async () => {
    const api = {
      get: vi.fn(async () => ({
        items: [
          {
            id: 'l1',
            projectId: 'p1',
            method: 'POST',
            path: '/users',
            fullUrl: 'https://mock.example.com/users',
            origin: 'mock',
            statusCode: 201,
            latencyMs: 84,
            scenarioType: 'success',
            scenarioSelectionSource: 'weighted-random',
            scenarioName: 'create-user',
            hasScenario: true,
            requestHeaders: { 'content-type': 'application/json' },
            requestBody: { name: 'Ada' },
            responseHeaders: { 'x-mock': 'true' },
            responseBody: { ok: true },
            createdAt: '2026-04-04T10:11:12.000Z',
          },
        ],
        nextCursor: { createdAt: '2026-04-04T10:11:12.000Z', id: 'l1' },
        serverTime: '2026-04-04T10:11:30.000Z',
      })),
      delete: vi.fn(async () => undefined),
    };

    const repository = createRepository(api);
    const result = await repository.listLogs('p1', {
      limit: 25,
      cursorCreatedAt: '2026-04-04T10:10:00.000Z',
      cursorId: 'l0',
    });

    expect(api.get).toHaveBeenCalledWith(
      '/projects/p1/logs?limit=25&cursorCreatedAt=2026-04-04T10%3A10%3A00.000Z&cursorId=l0',
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.scenarioSelectionSource).toBe('weighted-random');
    expect(result.nextCursor).toEqual({ createdAt: '2026-04-04T10:11:12.000Z', id: 'l1' });
    await expect(repository.clearLogs('p1')).resolves.toBeUndefined();
  });
});
