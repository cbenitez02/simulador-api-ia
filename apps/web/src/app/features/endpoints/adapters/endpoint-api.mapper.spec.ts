import { describe, expect, it } from 'vitest';
import { mapEndpointDraftFromApi, mapEndpointSummaryFromApi } from './endpoint-api.mapper';

describe('endpoint-api.mapper', () => {
  it('maps unsupported methods defensively and derives config percentages', () => {
    const result = mapEndpointSummaryFromApi({
      id: 'e1',
      projectId: 'p1',
      method: 'OPTIONS',
      path: '/users',
      description: '',
      statusCode: 200,
      responseBody: { ok: true },
      endpointConfig: {
        endpointId: 'e1',
        latencyMode: 'range',
        fixedDelayMs: 0,
        minDelayMs: 100,
        maxDelayMs: 300,
        errorRate: 0.25,
        useScenarioWeights: true,
      },
      scenarios: [],
    });

    expect(result.method).toBe('GET');
    expect(result.config?.latencyMs).toBe(200);
    expect(result.config?.errorRatePct).toBe(25);
  });

  it('hydrates edit draft using backend scenarios', () => {
    const result = mapEndpointDraftFromApi({
      id: 'e1',
      projectId: 'p1',
      method: 'PATCH',
      path: '/users/:id',
      description: 'Update user',
      statusCode: 200,
      responseBody: { ok: true },
      endpointConfig: {
        endpointId: 'e1',
        latencyMode: 'fixed',
        fixedDelayMs: 120,
        minDelayMs: 0,
        maxDelayMs: 500,
        errorRate: 0.1,
        useScenarioWeights: false,
      },
      scenarios: [
        {
          id: 's1',
          endpointId: 'e1',
          name: 'Success',
          type: 'success',
          statusCode: 200,
          body: { ok: true },
          delayMs: 120,
          weight: 100,
        },
      ],
    });

    expect(result.method).toBe('PATCH');
    expect(result.behavior.errorRate).toBe(10);
    expect(result.scenarios[0]?.id).toBe('s1');
  });
});
