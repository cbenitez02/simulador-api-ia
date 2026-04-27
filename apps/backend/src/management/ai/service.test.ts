import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeAiDraft } from './normalize-draft.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { activeAiPromptDescriptor } from './prompt-descriptor.js';

const mockedEnvModule = vi.hoisted(() => ({
  env: {
    AI_PRIMARY_PROVIDER: 'openai' as const,
    AI_FALLBACK_PROVIDER: undefined,
    OPENAI_MODEL: 'gpt-4.1-mini',
  },
}));

const authorizeProjectAccessMock = vi.fn();

vi.mock('../../config/env.js', () => mockedEnvModule);

vi.mock('../../auth/authorization.js', () => ({
  authorizeProjectAccess: authorizeProjectAccessMock,
}));

import {
  AiProviderExecutionError,
  createNormalizedDraftWithFallback,
  generateEndpointPreview,
  resetAiPreviewCacheForTests,
  type AiProvider,
} from './service.js';

const actor: AuthenticatedActor = {
  userId: 'user-1',
  email: 'owner@example.com',
  displayName: 'Owner User',
  personalWorkspaceId: 'workspace-1',
  identity: {
    provider: 'clerk',
    subject: 'user_clerk_123',
  },
  workspaceMemberships: [{ workspaceId: 'workspace-1', role: 'owner' }],
};

beforeEach(() => {
  authorizeProjectAccessMock.mockReset();
  authorizeProjectAccessMock.mockResolvedValue({ id: 'p1', workspaceId: 'workspace-1' });
  resetAiPreviewCacheForTests();
});

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

describe('generateEndpointPreview cache', () => {
  it('reutiliza previews cacheados por projectId y prompt normalizado sin filtrar mutaciones previas', async () => {
    const provider = {
      name: 'openai',
      generateJson: vi.fn().mockResolvedValue(
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
        })
      ),
    } satisfies AiProvider;

    const firstPreview = await generateEndpointPreview(actor, 'p1', '  Generate users  ', {
      providers: [provider],
      nowMs: 1_000,
    });

    firstPreview.scenarios[0]!.name = 'mutated in test';
    firstPreview.responseBody = { id: 'mutated' };

    const cachedPreview = await generateEndpointPreview(actor, 'p1', 'Generate users', {
      providers: [provider],
      nowMs: 1_001,
    });

    expect(provider.generateJson).toHaveBeenCalledTimes(1);
    expect(cachedPreview).toMatchObject({
      method: 'POST',
      path: '/users',
      responseBody: { id: 'u1' },
      scenarios: [{ name: 'success', type: 'success' }],
    });
  });

  it('aísla cache por projectId aun con el mismo prompt normalizado', async () => {
    const provider = {
      name: 'openai',
      generateJson: vi.fn().mockResolvedValue(
        JSON.stringify({
          method: 'GET',
          path: '/users',
          description: 'List users',
          statusCode: 200,
          responseBody: [{ id: 'u1' }],
          scenarios: [
            {
              name: 'success',
              type: 'success',
              statusCode: 200,
              body: [{ id: 'u1' }],
              delayMs: 0,
              weight: 1,
            },
          ],
        })
      ),
    } satisfies AiProvider;

    await generateEndpointPreview(actor, 'p1', 'Generate users', {
      providers: [provider],
      nowMs: 2_000,
    });
    await generateEndpointPreview(actor, 'p2', 'Generate users', {
      providers: [provider],
      nowMs: 2_001,
    });

    expect(provider.generateJson).toHaveBeenCalledTimes(2);
  });

  it('invalida el cache cuando cambia la versión del prompt descriptor', async () => {
    const originalVersion = activeAiPromptDescriptor.version;
    const provider = {
      name: 'openai',
      generateJson: vi.fn().mockResolvedValue(
        JSON.stringify({
          method: 'GET',
          path: '/users',
          description: 'List users',
          statusCode: 200,
          responseBody: [{ id: 'u1' }],
          scenarios: [
            {
              name: 'success',
              type: 'success',
              statusCode: 200,
              body: [{ id: 'u1' }],
              delayMs: 0,
              weight: 1,
            },
          ],
        })
      ),
    } satisfies AiProvider;

    try {
      await generateEndpointPreview(actor, 'p1', 'Generate users', {
        providers: [provider],
        nowMs: 2_100,
      });

      activeAiPromptDescriptor.version = 'v2';

      await generateEndpointPreview(actor, 'p1', 'Generate users', {
        providers: [provider],
        nowMs: 2_101,
      });

      expect(provider.generateJson).toHaveBeenCalledTimes(2);
    } finally {
      activeAiPromptDescriptor.version = originalVersion;
    }
  });

  it('invalida el cache cuando cambia el fingerprint del modelo configurado', async () => {
    const originalModel = mockedEnvModule.env.OPENAI_MODEL;
    const provider = {
      name: 'openai',
      generateJson: vi.fn().mockResolvedValue(
        JSON.stringify({
          method: 'GET',
          path: '/reports',
          description: 'List reports',
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
        })
      ),
    } satisfies AiProvider;

    try {
      mockedEnvModule.env.OPENAI_MODEL = 'gpt-4.1-mini';

      await generateEndpointPreview(actor, 'p1', 'Generate reports', {
        providers: [provider],
        nowMs: 2_200,
      });

      mockedEnvModule.env.OPENAI_MODEL = 'gpt-4.1-nano';

      await generateEndpointPreview(actor, 'p1', 'Generate reports', {
        providers: [provider],
        nowMs: 2_201,
      });

      expect(provider.generateJson).toHaveBeenCalledTimes(2);
    } finally {
      mockedEnvModule.env.OPENAI_MODEL = originalModel;
    }
  });

  it('expira entradas y permite reset explícito para pruebas determinísticas', async () => {
    const provider = {
      name: 'openai',
      generateJson: vi.fn().mockResolvedValue(
        JSON.stringify({
          method: 'GET',
          path: '/reports',
          description: 'List reports',
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
        })
      ),
    } satisfies AiProvider;

    await generateEndpointPreview(actor, 'p1', 'Generate reports', {
      providers: [provider],
      nowMs: 3_000,
    });
    await generateEndpointPreview(actor, 'p1', 'Generate reports', {
      providers: [provider],
      nowMs: 303_000,
    });

    resetAiPreviewCacheForTests();

    await generateEndpointPreview(actor, 'p1', 'Generate reports', {
      providers: [provider],
      nowMs: 303_001,
    });

    expect(provider.generateJson).toHaveBeenCalledTimes(3);
  });

  it('no cachea errores AI_UNAVAILABLE y reintenta en cada request', async () => {
    const provider = {
      name: 'openai',
      generateJson: vi
        .fn()
        .mockRejectedValue(new AiProviderExecutionError('openai', 'unavailable')),
    } satisfies AiProvider;

    await expect(
      generateEndpointPreview(actor, 'p1', 'Generate users with outage', {
        providers: [provider],
        nowMs: 4_000,
      })
    ).rejects.toMatchObject({
      options: { code: 'AI_UNAVAILABLE', retryable: true },
    });

    await expect(
      generateEndpointPreview(actor, 'p1', 'Generate users with outage', {
        providers: [provider],
        nowMs: 4_001,
      })
    ).rejects.toMatchObject({
      options: { code: 'AI_UNAVAILABLE', retryable: true },
    });

    expect(provider.generateJson).toHaveBeenCalledTimes(2);
  });

  it('no cachea errores AI_TIMEOUT y permite regenerar en el siguiente request', async () => {
    const provider = {
      name: 'openai',
      generateJson: vi
        .fn()
        .mockRejectedValueOnce(new AiProviderExecutionError('openai', 'timeout'))
        .mockResolvedValueOnce(
          JSON.stringify({
            method: 'GET',
            path: '/users',
            description: 'List users after retry',
            statusCode: 200,
            responseBody: [{ id: 'u1' }],
            scenarios: [
              {
                name: 'success',
                type: 'success',
                statusCode: 200,
                body: [{ id: 'u1' }],
                delayMs: 0,
                weight: 1,
              },
            ],
          })
        ),
    } satisfies AiProvider;

    await expect(
      generateEndpointPreview(actor, 'p1', 'Generate users after timeout', {
        providers: [provider],
        nowMs: 5_000,
      })
    ).rejects.toMatchObject({
      options: { code: 'AI_TIMEOUT', retryable: true },
    });

    await expect(
      generateEndpointPreview(actor, 'p1', 'Generate users after timeout', {
        providers: [provider],
        nowMs: 5_001,
      })
    ).resolves.toMatchObject({
      method: 'GET',
      path: '/users',
      responseBody: [{ id: 'u1' }],
    });
  });

  it('no cachea errores AI_INVALID_OUTPUT y vuelve a generar en el siguiente request', async () => {
    const provider = {
      name: 'openai',
      generateJson: vi
        .fn()
        .mockResolvedValueOnce(JSON.stringify({ method: 'GET', scenarios: [] }))
        .mockResolvedValueOnce(JSON.stringify({ method: 'GET', scenarios: [] }))
        .mockResolvedValueOnce(
          JSON.stringify({
            method: 'POST',
            path: '/users',
            description: 'Create user after invalid output',
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
          })
        ),
    } satisfies AiProvider;

    await expect(
      generateEndpointPreview(actor, 'p1', 'Generate users after invalid output', {
        providers: [provider],
        nowMs: 6_000,
      })
    ).rejects.toMatchObject({
      options: { code: 'AI_INVALID_OUTPUT', retryable: true },
    });

    await expect(
      generateEndpointPreview(actor, 'p1', 'Generate users after invalid output', {
        providers: [provider],
        nowMs: 6_001,
      })
    ).resolves.toMatchObject({
      method: 'POST',
      path: '/users',
      responseBody: { id: 'u1' },
    });
  });
});
