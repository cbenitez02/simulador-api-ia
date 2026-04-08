import { describe, expect, it } from 'vitest';
import { normalizeAiDraft } from './service.js';

describe('normalizeAiDraft', () => {
  it('normaliza method/path y expone locks para preview/persist', () => {
    const draft = normalizeAiDraft({
      method: 'post',
      path: ' users/:id ',
      description: 'Update user',
      statusCode: 200,
      responseBody: { ok: true },
      scenarios: [
        {
          name: 'primary success',
          type: 'success',
          statusCode: 200,
          body: { ok: true },
          delayMs: 5,
          weight: 2,
        },
      ],
    });

    expect(draft.method).toBe('POST');
    expect(draft.path).toBe('/users/:id');
    expect(draft.locks).toEqual({ method: true, path: true, scenarioType: true });
    expect(draft.scenarios).toEqual([
      {
        name: 'primary success',
        type: 'success',
        statusCode: 200,
        body: { ok: true },
        delayMs: 5,
        weight: 2,
      },
    ]);
  });

  it('mapea edge-case al enum MVP usando status/body para evitar labels no soportados', () => {
    const draft = normalizeAiDraft({
      method: 'get',
      path: 'reports',
      description: 'List reports',
      statusCode: 200,
      responseBody: [],
      scenarios: [
        {
          name: 'empty edge case',
          type: 'edge-case',
          statusCode: 204,
          body: [],
          delayMs: 0,
          weight: 1,
        },
        {
          name: 'server fallback',
          type: 'custom-problem',
          statusCode: 503,
          body: { error: 'upstream' },
          delayMs: 10,
          weight: 1,
        },
      ],
    });

    expect(draft.scenarios).toEqual([
      {
        name: 'empty edge case',
        type: 'empty',
        statusCode: 204,
        body: [],
        delayMs: 0,
        weight: 1,
      },
      {
        name: 'server fallback',
        type: 'error',
        statusCode: 503,
        body: { error: 'upstream' },
        delayMs: 10,
        weight: 1,
      },
    ]);
  });
});
