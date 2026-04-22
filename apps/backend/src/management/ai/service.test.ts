import { describe, expect, it } from 'vitest';
import { normalizeAiDraft } from './normalize-draft.js';
import {
  AiProviderExecutionError,
  createNormalizedDraftWithFallback,
  type AiProvider,
} from './service.js';

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

describe('createNormalizedDraftWithFallback', () => {
  it('usa el provider primario cuando ejecuta correctamente', async () => {
    const fallback = {
      name: 'compat',
      generateJson: async () => JSON.stringify({ invalid: true }),
    } satisfies AiProvider;
    const providers = [
      {
        name: 'openai',
        generateJson: async () =>
          JSON.stringify({
            method: 'GET',
            path: '/users',
            description: 'List users',
            statusCode: 200,
            responseBody: [],
            scenarios: [
              {
                name: 'success',
                type: 'success',
                statusCode: 200,
                body: [],
                delayMs: 0,
                weight: 1,
              },
            ],
          }),
      },
      fallback,
    ] satisfies AiProvider[];

    const draft = await createNormalizedDraftWithFallback('prompt', providers);

    expect(draft.method).toBe('GET');
    expect(draft.path).toBe('/users');
  });

  it('usa fallback solo ante error de ejecución del provider primario', async () => {
    const providers = [
      {
        name: 'openai',
        generateJson: async () => {
          throw new AiProviderExecutionError('openai', 'timeout');
        },
      },
      {
        name: 'compat',
        generateJson: async () =>
          JSON.stringify({
            method: 'POST',
            path: '/users',
            description: 'Create user',
            statusCode: 201,
            responseBody: { id: 'u1' },
            scenarios: [
              {
                name: 'success',
                type: 'success',
                statusCode: 201,
                body: { id: 'u1' },
                delayMs: 0,
                weight: 1,
              },
            ],
          }),
      },
    ] satisfies AiProvider[];

    const draft = await createNormalizedDraftWithFallback('prompt', providers);

    expect(draft.method).toBe('POST');
    expect(draft.path).toBe('/users');
  });

  it('no usa fallback cuando la salida del primario es inválida', async () => {
    const providers = [
      {
        name: 'openai',
        generateJson: async () => JSON.stringify({ method: 'GET', scenarios: [] }),
      },
      {
        name: 'compat',
        generateJson: async () =>
          JSON.stringify({
            method: 'POST',
            path: '/users',
            description: 'Should not be used',
            statusCode: 201,
            responseBody: { id: 'u1' },
            scenarios: [
              {
                name: 'success',
                type: 'success',
                statusCode: 201,
                body: { id: 'u1' },
                delayMs: 0,
                weight: 1,
              },
            ],
          }),
      },
    ] satisfies AiProvider[];

    await expect(createNormalizedDraftWithFallback('prompt', providers)).rejects.toMatchObject({
      options: { code: 'AI_INVALID_OUTPUT' },
    });
  });

  it('falla de forma determinística cuando no hay providers activos', async () => {
    await expect(createNormalizedDraftWithFallback('prompt', [])).rejects.toMatchObject({
      options: {
        code: 'AI_UNAVAILABLE',
        retryable: false,
      },
    });
  });
});
