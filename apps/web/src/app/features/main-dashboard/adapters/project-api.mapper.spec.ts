import { describe, expect, it } from 'vitest';
import { mapDashboardEndpointPreviewFromSummaryRow, mapDashboardProjectFromApi } from './project-api.mapper';

describe('project-api.mapper', () => {
  it('maps backend summary data into dashboard shape', () => {
    const result = mapDashboardProjectFromApi({
      project: {
        id: 'p1',
        name: 'Users API',
        description: '',
        slug: 'users-api',
        mockUrl: 'http://localhost:3000/mock/users-api',
        updatedAt: new Date().toISOString(),
        status: 'attention',
      },
      metrics: {
        totalEndpoints: 1,
        totalScenarios: 3,
        avgLatencyMs: 95,
        errorRatePct: 12.5,
        totalRequests: 8,
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
          method: 'POST',
          path: '/users',
          description: 'Create user',
          scenarioCount: 3,
          latencyMs: 95,
          errorRatePct: 12.5,
          status: 'ready',
        },
      ],
      recentRequests: [
        {
          id: 'log-1',
          method: 'POST',
          path: '/users',
          statusCode: 500,
          latencyMs: 140,
          scenarioType: 'error',
          createdAt: '2026-04-08T10:00:00.000Z',
        },
      ],
      configSummary: {
        latency: { enabled: true, mode: 'range', minMs: 50, maxMs: 250 },
        errorSimulation: { enabled: true, ratePct: 15, codes: [400, 500] },
        rateLimiting: { enabled: false, rpm: 60 },
        logging: { level: 'full' },
        scope: 'all',
      },
    });

    expect(result.status).toBe('attention');
    expect(result.mockUrl).toBe('http://localhost:3000/mock/users-api');
    expect(result.description).toBe('Your mock API workspace.');
    expect(result.metrics.totalScenarios).toBe(3);
    expect(result.health.errorScenarioEndpoints).toBe(1);
    expect(result.endpointRows[0]).toEqual(
      expect.objectContaining({ path: '/users', scenarioCount: 3, errorRatePct: 12.5 }),
    );
    expect(result.recentRequests[0]).toEqual(
      expect.objectContaining({ method: 'POST', statusCode: 500, scenarioType: 'error' }),
    );
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0]?.method).toBe('POST');
  });

  it('keeps recent requests empty and exposes default config badges when the project has no traffic', () => {
    const result = mapDashboardProjectFromApi({
      project: {
        id: 'p2',
        name: 'Empty API',
        description: 'Seedless',
        slug: 'empty-api',
        mockUrl: 'http://localhost:3000/mock/empty-api',
        updatedAt: new Date().toISOString(),
        status: 'empty',
      },
      metrics: {
        totalEndpoints: 0,
        totalScenarios: 0,
        avgLatencyMs: 0,
        errorRatePct: 0,
        totalRequests: 0,
      },
      health: {
        readyEndpoints: 0,
        needsAttentionEndpoints: 0,
        errorScenarioEndpoints: 0,
        emptyScenarioEndpoints: 0,
        timeoutScenarioEndpoints: 0,
      },
      endpointRows: [],
      recentRequests: [],
      configSummary: {
        latency: { enabled: false, mode: 'fixed', minMs: 0, maxMs: 1000 },
        errorSimulation: { enabled: false, ratePct: 0, codes: [500] },
        rateLimiting: { enabled: false, rpm: 60 },
        logging: { level: 'basic' },
        scope: 'all',
      },
    });

    expect(result.status).toBe('empty');
    expect(result.recentRequests).toEqual([]);
    expect(result.configSummary.logging.level).toBe('basic');
    expect(result.endpoints).toEqual([]);
  });

  it('maps summary endpoint rows into navigation-only previews explicitly derived on the frontend', () => {
    const preview = mapDashboardEndpointPreviewFromSummaryRow({
      endpointId: 'e1',
      method: 'POST',
      path: '/users',
      description: '',
      scenarioCount: 3,
      latencyMs: 95,
      errorRatePct: 12.5,
      status: 'ready',
    });

    expect(preview).toEqual({
      id: 'e1',
      method: 'POST',
      path: '/users',
      description: 'No description',
      latencyMs: 95,
      statusCode: 500,
      responseBody: null,
    });
  });
});
