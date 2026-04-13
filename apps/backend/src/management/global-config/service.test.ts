import { describe, expect, it } from 'vitest';
import { buildDefaultGlobalConfig } from './defaults.js';
import { buildDashboardSummary, buildProjectTrafficAggregate } from '../dashboard/summary.js';

describe('global-config/service', () => {
  it('shares one default global-config source with dashboard fallback mapping', () => {
    const defaults = buildDefaultGlobalConfig('project-1');

    const summary = buildDashboardSummary({
      project: {
        id: 'project-1',
        name: 'Users API',
        description: '',
        slug: 'users-api',
        updatedAt: new Date('2026-04-08T10:00:00.000Z'),
        globalConfig: null,
        endpoints: [],
      },
      traffic: buildProjectTrafficAggregate({
        totalRequests: 0,
        avgLatencyMs: null,
        errorRequests: 0,
      }),
      endpointLogs: new Map(),
      recentLogs: [],
      mockBaseUrl: 'https://mock.example.com/base',
    });

    expect(defaults).toEqual({
      projectId: 'project-1',
      latencyEnabled: false,
      latencyMinMs: 0,
      latencyMaxMs: 1000,
      latencyMode: 'fixed',
      errorSimulationEnabled: false,
      errorSimulationRate: 0,
      errorSimulationCodes: [500],
      rateLimitingEnabled: false,
      rateLimitingRpm: 60,
      loggingLevel: 'basic',
      scope: 'all',
    });
    expect(summary.configSummary).toEqual({
      latency: {
        enabled: defaults.latencyEnabled,
        mode: defaults.latencyMode,
        minMs: 0,
        maxMs: 1000,
      },
      errorSimulation: { enabled: defaults.errorSimulationEnabled, ratePct: 0, codes: [500] },
      rateLimiting: { enabled: defaults.rateLimitingEnabled, rpm: defaults.rateLimitingRpm },
      logging: { level: defaults.loggingLevel },
      scope: defaults.scope,
    });
  });

  it('returns a fresh default error-codes array for each project fallback instance', () => {
    const first = buildDefaultGlobalConfig('project-1');
    const second = buildDefaultGlobalConfig('project-2');

    first.errorSimulationCodes.push(503);

    expect(first.errorSimulationCodes).toEqual([500, 503]);
    expect(second.errorSimulationCodes).toEqual([500]);
  });
});
