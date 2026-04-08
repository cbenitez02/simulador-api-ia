import { describe, expect, it } from 'vitest';
import { mapLogFromApi, mapLogListFromApi } from './logs-api.mapper';

describe('logs-api.mapper', () => {
  it('maps persisted traceability values without relabeling them', () => {
    const result = mapLogFromApi({
      id: 'l1',
      projectId: 'p1',
      method: 'HEAD',
      path: '/users',
      fullUrl: 'http://localhost:3000/mock/users/users',
      origin: 'forced-error',
      statusCode: 504,
      latencyMs: 900,
      scenarioType: 'timeout',
      scenarioSelectionSource: 'weighted-random',
      scenarioName: null,
      hasScenario: false,
      requestHeaders: {},
      requestBody: null,
      responseHeaders: {},
      responseBody: { error: 'timeout' },
      createdAt: '2026-04-04T12:00:00.000Z',
    });

    expect(result.method).toBe('GET');
    expect(result.origin).toBe('forced-error');
    expect(result.scenario).toBe('timeout');
    expect(result.scenarioSelectionSource).toBe('weighted-random');
    expect(result.scenarioName).toBeNull();
    expect(result.hasScenario).toBe(false);
  });

  it('maps list envelopes with cursor and server time', () => {
    const result = mapLogListFromApi({
      items: [
        {
          id: 'l1',
          projectId: 'p1',
          method: 'POST',
          path: '/users',
          fullUrl: 'https://mock.example.com/users',
          origin: 'mock',
          statusCode: 201,
          latencyMs: 84,
          scenarioType: 'success',
          scenarioSelectionSource: 'weighted-random',
          scenarioName: 'create-user',
          hasScenario: true,
          requestHeaders: { 'content-type': 'application/json' },
          requestBody: { name: 'Ada' },
          responseHeaders: { 'x-mock': 'true' },
          responseBody: { ok: true },
          createdAt: '2026-04-04T10:11:12.000Z',
        },
      ],
      nextCursor: { createdAt: '2026-04-04T10:11:12.000Z', id: 'l1' },
      serverTime: '2026-04-04T10:11:30.000Z',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.scenarioName).toBe('create-user');
    expect(result.nextCursor).toEqual({ createdAt: '2026-04-04T10:11:12.000Z', id: 'l1' });
    expect(result.serverTime).toBe('2026-04-04T10:11:30.000Z');
  });

  it('preserves rate-limit block metadata for runtime logs', () => {
    const result = mapLogFromApi({
      id: 'l-rl',
      projectId: 'p1',
      method: 'GET',
      path: '/users',
      fullUrl: 'https://mock.example.com/users',
      origin: 'mock',
      statusCode: 429,
      latencyMs: 0,
      scenarioType: 'rate-limit-block',
      scenarioSelectionSource: 'rate-limit',
      scenarioName: null,
      hasScenario: false,
      requestHeaders: {},
      requestBody: null,
      responseHeaders: { 'retry-after': '55' },
      responseBody: { error: 'Rate limit exceeded' },
      createdAt: '2026-04-08T12:00:00.000Z',
    });

    expect(result.scenario).toBe('rate-limit-block');
    expect(result.scenarioSelectionSource).toBe('rate-limit');
  });
});
