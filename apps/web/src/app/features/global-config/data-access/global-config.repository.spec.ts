import { setupAngularVitest } from '../../../testing/angular-vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../../shared/http/api-client';
import { GlobalConfigRepository } from './global-config.repository';

setupAngularVitest();

describe('GlobalConfigRepository', () => {
  function createRepository(api: object) {
    const injector = Injector.create({
      providers: [{ provide: ApiClient, useValue: api }],
    });

    return runInInjectionContext(injector, () => new GlobalConfigRepository());
  }

  it('maps save responses back into UI shape', async () => {
    const api = {
      put: vi.fn(async () => ({
        projectId: 'p1',
        latencyEnabled: true,
        latencyMinMs: 100,
        latencyMaxMs: 200,
        latencyMode: 'range',
        errorSimulationEnabled: false,
        errorSimulationRate: 0,
        errorSimulationCodes: [500],
        rateLimitingEnabled: false,
        rateLimitingRpm: 60,
        loggingLevel: 'full',
        scope: 'unset',
      })),
    };

    const repository = createRepository(api);
    const result = await repository.saveConfig('p1', {
      latency: { enabled: true, minMs: 100, maxMs: 200, mode: 'random' },
      errorSimulation: { enabled: false, rate: 0, statusCodes: [500] },
      rateLimiting: { enabled: false, requestsPerMinute: 60 },
      logging: { level: 'verbose' },
      scope: 'without-overrides',
    });

    expect(api.put).toHaveBeenCalledWith('/projects/p1/config', expect.objectContaining({ scope: 'all' }));
    expect(result.logging.level).toBe('verbose');
    expect(result.scope).toBe('all');
  });
});
