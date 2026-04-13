import { afterEach, describe, expect, it } from 'vitest';
import {
  mapCreatedProjectPlaceholder,
  mapDashboardEndpointPreviewFromSummaryRow,
  mapDashboardProjectFromApi,
} from './project-api.mapper';

type RuntimeConfigGlobal = typeof globalThis & {
  __SIMULADOR_RUNTIME_CONFIG__?: {
    apiBaseUrl?: string;
    mockBaseUrl?: string;
  };
};

const runtimeConfigGlobal = globalThis as RuntimeConfigGlobal;

describe('project-api.mapper', () => {
  afterEach(() => {
    delete runtimeConfigGlobal.__SIMULADOR_RUNTIME_CONFIG__;
  });

  it('maps backend summary data into dashboard shape', () => {
    const result = mapDashboardProjectFromApi({
      project: {
        id: 'p1',
        name: 'Users API',
        description: '',
        slug: 'users-api',
        mockUrl: 'https://mock.example.com/users-api',
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
    expect(result.mockUrl).toBe('https://mock.example.com/users-api');
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
        mockUrl: 'https://mock.example.com/empty-api',
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

  it('builds placeholder mock URLs from runtime config when the backend has not returned a summary yet', () => {
    runtimeConfigGlobal.__SIMULADOR_RUNTIME_CONFIG__ = {
      mockBaseUrl: 'https://deploy.example.com/mock',
    };

    const result = mapCreatedProjectPlaceholder({
      id: 'p3',
      name: 'Generated API',
      slug: 'generated-api',
      description: '',
      updatedAt: new Date().toISOString(),
      _count: { endpoints: 0 },
    });

    expect(result.mockUrl).toBe('https://deploy.example.com/mock/generated-api');
  });

  it('uses project endpoint counts to build placeholder dashboard rows before summary hydration', () => {
    const result = mapCreatedProjectPlaceholder({
      id: 'p3',
      name: 'Generated API',
      slug: 'generated-api',
      description: '',
      updatedAt: new Date().toISOString(),
      _count: { endpoints: 2 },
    });

    expect(result.metrics.totalEndpoints).toBe(2);
    expect(result.health.needsAttentionEndpoints).toBe(2);
    expect(result.endpointRows).toEqual([
      expect.objectContaining({ endpointId: 'p3-placeholder-1', path: 'Endpoint 1' }),
      expect.objectContaining({ endpointId: 'p3-placeholder-2', path: 'Endpoint 2' }),
    ]);
    expect(result.endpoints).toEqual([
      expect.objectContaining({ id: 'p3-placeholder-1', path: 'Endpoint 1' }),
      expect.objectContaining({ id: 'p3-placeholder-2', path: 'Endpoint 2' }),
    ]);
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
