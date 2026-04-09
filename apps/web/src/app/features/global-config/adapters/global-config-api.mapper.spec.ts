import { describe, expect, it } from 'vitest';
import { mapGlobalConfigFromApi, mapGlobalConfigToApi } from './global-config-api.mapper';

describe('global-config-api.mapper', () => {
  it('normalizes backend enums into frontend values and canonical MVP scope', () => {
    const result = mapGlobalConfigFromApi({
      projectId: 'p1',
      latencyEnabled: true,
      latencyMinMs: 100,
      latencyMaxMs: 300,
      latencyMode: 'range',
      errorSimulationEnabled: true,
      errorSimulationRate: 0.15,
      errorSimulationCodes: [400, 500],
      rateLimitingEnabled: true,
      rateLimitingRpm: 120,
      loggingLevel: 'off',
      scope: 'unset',
    });

    expect(result.latency.mode).toBe('random');
    expect(result.errorSimulation.rate).toBe(15);
    expect(result.logging.level).toBe('none');
    expect(result.scope).toBe('all');
  });

  it('maps frontend values back to backend payloads with canonical scope', () => {
    const result = mapGlobalConfigToApi({
      latency: { enabled: true, minMs: 10, maxMs: 50, mode: 'random' },
      errorSimulation: { enabled: true, rate: 20, statusCodes: [500] },
      rateLimiting: { enabled: false, requestsPerMinute: 100 },
      logging: { level: 'verbose' },
      scope: 'without-overrides',
    });

    expect(result.latencyMode).toBe('range');
    expect(result.errorSimulationRate).toBe(0.2);
    expect(result.loggingLevel).toBe('full');
    expect(result.scope).toBe('all');
  });
});
