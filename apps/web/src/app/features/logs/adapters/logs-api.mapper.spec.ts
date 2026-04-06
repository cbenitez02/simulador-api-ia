import { describe, expect, it } from 'vitest';
import { mapLogFromApi } from './logs-api.mapper';

describe('logs-api.mapper', () => {
  it('maps unsupported scenario types safely', () => {
    const result = mapLogFromApi({
      id: 'l1',
      projectId: 'p1',
      method: 'HEAD',
      path: '/users',
      fullUrl: 'http://localhost:3000/mock/users/users',
      statusCode: 504,
      latencyMs: 900,
      scenarioType: 'timeout',
      scenarioSelectionSource: 'weighted',
      requestHeaders: {},
      requestBody: null,
      responseHeaders: {},
      responseBody: { error: 'timeout' },
      createdAt: '2026-04-04T12:00:00.000Z',
    });

    expect(result.method).toBe('GET');
    expect(result.scenario).toBe('error');
    expect(result.scenarioSelectionSource).toBe('weighted');
  });
});
