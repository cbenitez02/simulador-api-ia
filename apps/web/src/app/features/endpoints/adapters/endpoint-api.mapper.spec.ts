import { describe, expect, it } from 'vitest';
import {
  mapAiDraftFromApi,
  mapEndpointConfigRequestFromDraft,
  mapEndpointDraftFromApi,
  mapEndpointSummaryFromApi,
} from './endpoint-api.mapper';

describe('endpoint-api.mapper', () => {
  it('maps unsupported methods defensively and zeroes unsupported endpoint error rate', () => {
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
    expect(result.config?.errorRatePct).toBe(0);
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
    expect(result.behavior.errorRate).toBe(0);
    expect(result.scenarios[0]?.id).toBe('s1');
  });

  it('forces endpoint config payloads to keep errorRate disabled in MVP', () => {
    const result = mapEndpointConfigRequestFromDraft('e1', {
      method: 'GET',
      route: '/users',
      description: 'List users',
      statusCode: 200,
      responseBody: { ok: true },
      behavior: {
        latencyMode: 'range',
        fixedDelayMs: 0,
        minDelayMs: 50,
        maxDelayMs: 250,
        errorRate: 35,
        useScenarioWeights: true,
      },
      scenarios: [],
      locks: { method: false, path: false, scenarioType: false },
      source: 'manual',
    });

    expect(result.errorRate).toBe(0);
  });

  it('maps ai preview dto into a locked MVP draft without contract drift', () => {
    const result = mapAiDraftFromApi({
      method: 'POST',
      path: '/users',
      description: 'Create user',
      statusCode: 201,
      responseBody: { id: 'u1' },
      locks: { method: true, path: true, scenarioType: true },
      scenarios: [
        {
          name: 'Success',
          type: 'success',
          statusCode: 201,
          body: { id: 'u1' },
          delayMs: 120,
          weight: 80,
        },
        {
          name: 'Empty',
          type: 'empty',
          statusCode: 204,
          body: [],
          delayMs: 0,
          weight: 20,
        },
      ],
    });

    expect(result).toMatchObject({
      method: 'POST',
      route: '/users',
      description: 'Create user',
      statusCode: 201,
      responseBody: { id: 'u1' },
      locks: {
        method: true,
        path: true,
        scenarioType: true,
      },
      source: 'ai-preview',
    });
    expect(result.scenarios).toHaveLength(2);
    expect(result.scenarios[0]?.type).toBe('success');
    expect(result.scenarios[1]?.type).toBe('empty');
  });
});
