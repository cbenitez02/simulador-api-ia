import { describe, expect, it } from 'vitest';
import {
  buildDashboardSummary,
  buildProjectTrafficAggregate,
  calculateErrorRatePct,
  resolveLatencyFallback,
} from './summary.js';

describe('dashboard/service', () => {
  it('builds rule-based status, health, and log-driven metrics for mixed dashboard data', () => {
    const summary = buildDashboardSummary({
      project: {
        id: 'project-1',
        name: 'Users API',
        description: 'Real dashboard data',
        slug: 'users-api',
        updatedAt: new Date('2026-04-08T10:00:00.000Z'),
        globalConfig: {
          latencyEnabled: true,
          latencyMinMs: 100,
          latencyMaxMs: 400,
          latencyMode: 'range',
          errorSimulationEnabled: true,
          errorSimulationRate: 0.15,
          errorSimulationCodes: [400, 500],
          rateLimitingEnabled: true,
          rateLimitingRpm: 90,
          loggingLevel: 'full',
          scope: 'all',
        },
        endpoints: [
          {
            id: 'e-ready',
            method: 'GET',
            path: '/users',
            description: 'List users',
            endpointConfig: {
              latencyMode: 'fixed',
              fixedDelayMs: 90,
              minDelayMs: 0,
              maxDelayMs: 0,
            },
            scenarios: [
              { id: 's-1', type: 'success' },
              { id: 's-2', type: 'error' },
            ],
          },
          {
            id: 'e-attention',
            method: 'POST',
            path: '/users',
            description: 'Create user',
            endpointConfig: {
              latencyMode: 'range',
              fixedDelayMs: 0,
              minDelayMs: 80,
              maxDelayMs: 180,
            },
            scenarios: [],
          },
          {
            id: 'e-empty',
            method: 'DELETE',
            path: '/users/:id',
            description: 'Delete user',
            endpointConfig: null,
            scenarios: [
              { id: 's-3', type: 'empty' },
              { id: 's-4', type: 'timeout' },
            ],
          },
        ],
      },
      traffic: buildProjectTrafficAggregate({
        totalRequests: 5,
        avgLatencyMs: 112.6,
        errorRequests: 2,
      }),
      endpointLogs: new Map([
        [
          'GET /users',
          {
            method: 'GET',
            path: '/users',
            totalRequests: 3,
            errorRequests: 1,
            avgLatencyMs: 125,
          },
        ],
      ]),
      recentLogs: [
        {
          id: 'log-1',
          method: 'GET',
          path: '/users',
          statusCode: 500,
          latencyMs: 145,
          scenarioType: 'error',
          createdAt: new Date('2026-04-08T11:00:00.000Z'),
        },
      ],
    });

    expect(summary.project.status).toBe('attention');
    expect(summary.metrics).toEqual({
      totalEndpoints: 3,
      totalScenarios: 4,
      avgLatencyMs: 113,
      errorRatePct: 40,
      totalRequests: 5,
    });
    expect(summary.health).toEqual({
      readyEndpoints: 2,
      needsAttentionEndpoints: 1,
      errorScenarioEndpoints: 1,
      emptyScenarioEndpoints: 1,
      timeoutScenarioEndpoints: 1,
    });
    expect(summary.endpointRows).toEqual([
      expect.objectContaining({
        endpointId: 'e-ready',
        scenarioCount: 2,
        latencyMs: 125,
        errorRatePct: 33.3,
        status: 'ready',
      }),
      expect.objectContaining({
        endpointId: 'e-attention',
        scenarioCount: 0,
        latencyMs: 130,
        errorRatePct: 0,
        status: 'needs-attention',
      }),
      expect.objectContaining({
        endpointId: 'e-empty',
        scenarioCount: 2,
        latencyMs: 0,
        errorRatePct: 0,
        status: 'ready',
      }),
    ]);
    expect(summary.recentRequests).toEqual([
      {
        id: 'log-1',
        method: 'GET',
        path: '/users',
        statusCode: 500,
        latencyMs: 145,
        scenarioType: 'error',
        createdAt: '2026-04-08T11:00:00.000Z',
      },
    ]);
    expect(summary.configSummary.errorSimulation.ratePct).toBe(15);
    expect(summary.configSummary.logging.level).toBe('full');
  });

  it('returns empty-state metrics and default config when there are no logs or custom config', () => {
    const summary = buildDashboardSummary({
      project: {
        id: 'project-empty',
        name: 'Empty API',
        description: '',
        slug: 'empty-api',
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
    });

    expect(summary.project.status).toBe('empty');
    expect(summary.metrics).toEqual({
      totalEndpoints: 0,
      totalScenarios: 0,
      avgLatencyMs: 0,
      errorRatePct: 0,
      totalRequests: 0,
    });
    expect(summary.health).toEqual({
      readyEndpoints: 0,
      needsAttentionEndpoints: 0,
      errorScenarioEndpoints: 0,
      emptyScenarioEndpoints: 0,
      timeoutScenarioEndpoints: 0,
    });
    expect(summary.recentRequests).toEqual([]);
    expect(summary.configSummary).toEqual({
      latency: { enabled: false, mode: 'fixed', minMs: 0, maxMs: 1000 },
      errorSimulation: { enabled: false, ratePct: 0, codes: [500] },
      rateLimiting: { enabled: false, rpm: 60 },
      logging: { level: 'basic' },
      scope: 'all',
    });
  });

  it('uses config fallback latency and exact percentage helpers for endpoint rows', () => {
    expect(
      resolveLatencyFallback({
        latencyMode: 'fixed',
        fixedDelayMs: 55,
        minDelayMs: 0,
        maxDelayMs: 0,
      })
    ).toBe(55);
    expect(
      resolveLatencyFallback({
        latencyMode: 'range',
        fixedDelayMs: 0,
        minDelayMs: 80,
        maxDelayMs: 180,
      })
    ).toBe(130);
    expect(resolveLatencyFallback(null)).toBe(0);
    expect(calculateErrorRatePct(0, 0)).toBe(0);
    expect(calculateErrorRatePct(1, 3)).toBe(33.3);
  });
});
