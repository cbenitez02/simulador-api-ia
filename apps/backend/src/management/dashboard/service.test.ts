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
        workspace: {
          id: 'workspace-1',
          name: 'Personal',
          kind: 'personal',
          role: 'owner',
          isPersonal: true,
          capabilities: {
            canEdit: true,
            canManageMembers: true,
            canRestoreSnapshots: true,
            canImportContracts: true,
          },
        },
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
      },
      endpointRows: [
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
          scenarioCount: 2,
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
          scenarioCount: 0,
        },
        {
          id: 'e-empty',
          method: 'DELETE',
          path: '/users/:id',
          description: 'Delete user',
          endpointConfig: null,
          scenarioCount: 2,
        },
      ],
      endpointRowsMeta: { total: 3, limit: 10, hasMore: false },
      traffic: buildProjectTrafficAggregate({
        totalRequests: 5,
        avgLatencyMs: 112.6,
        errorRequests: 2,
      }),
      totalScenarios: 4,
      health: {
        readyEndpoints: 2,
        needsAttentionEndpoints: 1,
        errorScenarioEndpoints: 1,
        emptyScenarioEndpoints: 1,
        timeoutScenarioEndpoints: 1,
      },
      projectStatus: 'attention',
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
      mockBaseUrl: 'https://mock.example.com/base/',
    });

    expect(summary.project.status).toBe('attention');
    expect(summary.project.mockUrl).toBe('https://mock.example.com/base/users-api');
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
    expect(summary.endpointRowsMeta).toEqual({ total: 3, limit: 10, hasMore: false });
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
        workspace: {
          id: 'workspace-1',
          name: 'Team',
          kind: 'team',
          role: 'viewer',
          isPersonal: false,
          capabilities: {
            canEdit: false,
            canManageMembers: false,
            canRestoreSnapshots: false,
            canImportContracts: false,
          },
        },
        updatedAt: new Date('2026-04-08T10:00:00.000Z'),
        globalConfig: null,
      },
      endpointRows: [],
      endpointRowsMeta: { total: 0, limit: 10, hasMore: false },
      traffic: buildProjectTrafficAggregate({
        totalRequests: 0,
        avgLatencyMs: null,
        errorRequests: 0,
      }),
      totalScenarios: 0,
      health: {
        readyEndpoints: 0,
        needsAttentionEndpoints: 0,
        errorScenarioEndpoints: 0,
        emptyScenarioEndpoints: 0,
        timeoutScenarioEndpoints: 0,
      },
      projectStatus: 'empty',
      endpointLogs: new Map(),
      recentLogs: [],
      mockBaseUrl: 'https://mock.example.com/base',
    });

    expect(summary.project.status).toBe('empty');
    expect(summary.project.mockUrl).toBe('https://mock.example.com/base/empty-api');
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
    expect(summary.endpointRowsMeta).toEqual({ total: 0, limit: 10, hasMore: false });
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
