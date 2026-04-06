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
      get: vi.fn(async () => []),
      delete: vi.fn(async () => undefined),
    };

    const repository = createRepository(api);
    const result = await repository.listLogs('p1');

    expect(result).toEqual([]);
    await expect(repository.clearLogs('p1')).resolves.toBeUndefined();
  });
});
