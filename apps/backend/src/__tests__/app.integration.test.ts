import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import { resetRateLimitStoreForTests } from '../mock-server/rate-limit.js';

const openaiCreateMock = vi.fn();

const prismaMock = {
  project: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  endpoint: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  scenario: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  endpointConfig: {
    create: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  globalConfig: {
    create: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  apiLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    public chat = {
      completions: {
        create: openaiCreateMock,
      },
    };
  },
}));

let app: Express;

function buildMockProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    slug: 'demo',
    globalConfig: {
      latencyEnabled: false,
      latencyMode: 'fixed',
      latencyMinMs: 0,
      latencyMaxMs: 0,
      scope: 'all',
      errorSimulationEnabled: false,
      errorSimulationRate: 0,
      errorSimulationCodes: [500],
      rateLimitingEnabled: false,
      rateLimitingRpm: 60,
      loggingLevel: 'basic',
    },
    ...overrides,
  };
}

function buildRateLimitedProject(overrides: Record<string, unknown> = {}) {
  return buildMockProject({
    globalConfig: {
      ...buildMockProject().globalConfig,
      rateLimitingEnabled: true,
      rateLimitingRpm: 2,
      ...overrides,
    },
  });
}

function buildMockEndpoint(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    endpointConfig: {
      latencyMode: 'fixed',
      fixedDelayMs: 0,
      minDelayMs: 0,
      maxDelayMs: 0,
      useScenarioWeights: true,
    },
    scenarios: [],
    statusCode: 200,
    responseBody: { ok: true },
    ...overrides,
  };
}

describe('app integration', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://user:password@localhost:5432/simulador_api_ia_test';
    process.env.OPENAI_API_KEY ??= 'test-key';
    process.env.OPENAI_MODEL ??= 'gpt-4.1-mini';

    ({ app } = await import('../app.js'));
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    resetRateLimitStoreForTests();
  });

  it('GET /api/v1/projects responde lista', async () => {
    prismaMock.project.findMany.mockResolvedValueOnce([
      { id: 'p1', name: 'Proyecto', slug: 'proyecto', description: '', _count: { endpoints: 0 } },
    ]);

    const response = await request(app).get('/api/v1/projects');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].slug).toBe('proyecto');
  });

  it('POST /api/v1/projects crea proyecto + global config', async () => {
    prismaMock.project.findMany.mockResolvedValueOnce([]);

    const tx = {
      project: {
        create: vi.fn().mockResolvedValue({ id: 'p1' }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'p1',
          name: 'Mi API',
          slug: 'mi-api',
          description: '',
          globalConfig: { projectId: 'p1' },
          _count: { endpoints: 0 },
        }),
      },
      globalConfig: {
        create: vi.fn().mockResolvedValue({ id: 'gc1' }),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(async (callback) => callback(tx));

    const response = await request(app).post('/api/v1/projects').send({ name: 'Mi API' });

    expect(response.status).toBe(201);
    expect(response.body.slug).toBe('mi-api');
    expect(tx.globalConfig.create).toHaveBeenCalledTimes(1);
  });

  it('PATCH /api/v1/projects/:projectId actualiza metadata sin cambiar slug', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1' });
    prismaMock.project.update.mockResolvedValueOnce({
      id: 'p1',
      name: 'Mi API v2',
      slug: 'mi-api',
      description: 'Nuevo texto',
      globalConfig: { projectId: 'p1' },
      _count: { endpoints: 0 },
    });

    const response = await request(app)
      .patch('/api/v1/projects/p1')
      .send({ name: 'Mi API v2', description: 'Nuevo texto' });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Mi API v2');
    expect(response.body.slug).toBe('mi-api');
  });

  it('PATCH /api/v1/projects/:projectId responde 404 si el proyecto no existe', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce(null);

    const response = await request(app)
      .patch('/api/v1/projects/p404')
      .send({ name: 'Ghost project' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Project not found');
  });

  it('DELETE /api/v1/projects/:projectId responde 204 sin body', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1' });
    prismaMock.project.delete.mockResolvedValueOnce({ id: 'p1' });

    const response = await request(app).delete('/api/v1/projects/p1');

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
  });

  it('DELETE /api/v1/projects/:projectId responde 404 si el proyecto no existe', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce(null);

    const response = await request(app).delete('/api/v1/projects/p404');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Project not found');
  });

  it('POST /api/v1/projects/:projectId/endpoints responde 409 si ya existe', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1' });
    prismaMock.endpoint.findFirst.mockResolvedValueOnce({ id: 'e1' });

    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints')
      .send({ method: 'GET', path: '/users' });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/already exists/i);
  });

  it('POST /api/v1/endpoints/:endpointId/scenarios crea scenario', async () => {
    prismaMock.endpoint.findUnique.mockResolvedValueOnce({ id: 'e1' });
    prismaMock.scenario.create.mockResolvedValueOnce({
      id: 's1',
      endpointId: 'e1',
      name: 'ok',
      type: 'success',
      statusCode: 200,
      body: { ok: true },
      delayMs: 0,
      weight: 1,
    });

    const response = await request(app)
      .post('/api/v1/endpoints/e1/scenarios')
      .send({ name: 'ok', type: 'success', statusCode: 200, body: { ok: true } });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe('s1');
  });

  it('GET /mock/:projectSlug/:path responde y loguea fire-and-forget', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce(buildMockProject());

    prismaMock.endpoint.findFirst.mockResolvedValueOnce(buildMockEndpoint());

    prismaMock.apiLog.create.mockResolvedValueOnce({ id: 'l1' });

    const response = await request(app).get('/mock/demo/users');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers['x-simulador-scenario']).toBe('direct');
    expect(prismaMock.apiLog.create).toHaveBeenCalledTimes(1);
  });

  it('GET /mock/:projectSlug/:path aplica rate limiting habilitado y expone headers de cuota', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(65_000);
    prismaMock.project.findUnique.mockResolvedValue(buildRateLimitedProject());
    prismaMock.endpoint.findFirst.mockResolvedValue(buildMockEndpoint());
    prismaMock.apiLog.create.mockResolvedValue({ id: 'l1' });

    const first = await request(app).get('/mock/demo/users');
    const second = await request(app).get('/mock/demo/users');

    expect(first.status).toBe(200);
    expect(first.headers['x-ratelimit-limit']).toBe('2');
    expect(first.headers['x-ratelimit-remaining']).toBe('1');
    expect(first.headers['x-ratelimit-reset']).toBe('120');
    expect(first.headers['retry-after']).toBeUndefined();

    expect(second.status).toBe(200);
    expect(second.headers['x-ratelimit-limit']).toBe('2');
    expect(second.headers['x-ratelimit-remaining']).toBe('0');
    expect(second.headers['x-ratelimit-reset']).toBe('120');
  });

  it('GET /mock/:projectSlug/:path bloquea el request N+1 con 429, retry-after y logging', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(65_000);
    prismaMock.project.findUnique.mockResolvedValue(buildRateLimitedProject());
    prismaMock.endpoint.findFirst.mockResolvedValue(buildMockEndpoint());
    prismaMock.apiLog.create.mockResolvedValue({ id: 'l1' });

    await request(app).get('/mock/demo/users');
    await request(app).get('/mock/demo/users');
    const blocked = await request(app).get('/mock/demo/users');

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'Rate limit exceeded' });
    expect(blocked.headers['x-ratelimit-limit']).toBe('2');
    expect(blocked.headers['x-ratelimit-remaining']).toBe('0');
    expect(blocked.headers['x-ratelimit-reset']).toBe('120');
    expect(blocked.headers['retry-after']).toBe('55');
    expect(blocked.headers['x-simulador-scenario']).toBeUndefined();
    expect(blocked.headers['x-simulador-latency']).toBeUndefined();

    expect(prismaMock.apiLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        projectId: 'p1',
        origin: 'mock',
        statusCode: 429,
        latencyMs: 0,
        scenarioType: 'rate-limit-block',
        scenarioSelectionSource: 'rate-limit',
        scenarioName: null,
        responseHeaders: {
          'X-RateLimit-Limit': '2',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '120',
          'Retry-After': '55',
          'Content-Type': 'application/json',
        },
      }),
    });
  });

  it('GET /mock/:projectSlug/:path resetea la cuota cuando entra una nueva ventana', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(65_000)
      .mockReturnValueOnce(65_000)
      .mockReturnValueOnce(121_000);
    prismaMock.project.findUnique.mockResolvedValue(
      buildRateLimitedProject({ rateLimitingRpm: 1 })
    );
    prismaMock.endpoint.findFirst.mockResolvedValue(buildMockEndpoint());
    prismaMock.apiLog.create.mockResolvedValue({ id: 'l1' });

    const first = await request(app).get('/mock/demo/users');
    const blocked = await request(app).get('/mock/demo/users');
    const reset = await request(app).get('/mock/demo/users');

    expect(first.status).toBe(200);
    expect(blocked.status).toBe(429);
    expect(reset.status).toBe(200);
    expect(reset.headers['x-ratelimit-limit']).toBe('1');
    expect(reset.headers['x-ratelimit-remaining']).toBe('0');
    expect(reset.headers['x-ratelimit-reset']).toBe('180');
  });

  it('GET /mock/:projectSlug/:path bypasses limiter and omits rate-limit headers when disabled', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(65_000);
    prismaMock.project.findUnique.mockResolvedValue(
      buildMockProject({
        globalConfig: {
          ...buildMockProject().globalConfig,
          rateLimitingEnabled: false,
          rateLimitingRpm: 1,
        },
      })
    );
    prismaMock.endpoint.findFirst.mockResolvedValue(buildMockEndpoint());
    prismaMock.apiLog.create.mockResolvedValue({ id: 'l1' });

    const first = await request(app).get('/mock/demo/users');
    const second = await request(app).get('/mock/demo/users');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers['x-ratelimit-limit']).toBeUndefined();
    expect(first.headers['x-ratelimit-remaining']).toBeUndefined();
    expect(first.headers['x-ratelimit-reset']).toBeUndefined();
    expect(second.headers['x-ratelimit-limit']).toBeUndefined();
    expect(second.headers['retry-after']).toBeUndefined();
  });

  it('GET /mock/:projectSlug/:path ignores scope for MVP and keeps project-wide enforcement', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(65_000);
    prismaMock.project.findUnique.mockResolvedValue(
      buildRateLimitedProject({
        rateLimitingRpm: 1,
        scope: 'unset',
      })
    );
    prismaMock.endpoint.findFirst.mockResolvedValue(buildMockEndpoint());
    prismaMock.apiLog.create.mockResolvedValue({ id: 'l1' });

    const first = await request(app).get('/mock/demo/users');
    const blocked = await request(app).get('/mock/demo/users');

    expect(first.status).toBe(200);
    expect(first.headers['x-ratelimit-limit']).toBe('1');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['x-ratelimit-limit']).toBe('1');
    expect(blocked.headers['retry-after']).toBe('55');
  });

  it('GET /api/v1/projects/:projectId/logs devuelve últimos logs', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1' });
    prismaMock.apiLog.findMany.mockResolvedValueOnce([
      {
        id: 'l2',
        projectId: 'p1',
        method: 'GET',
        path: '/users',
        fullUrl: 'https://mock.example.com/users',
        origin: 'mock',
        statusCode: 200,
        latencyMs: 10,
        scenarioType: 'default',
        scenarioSelectionSource: 'direct-endpoint',
        scenarioName: null,
        requestHeaders: {},
        requestBody: null,
        responseHeaders: {},
        responseBody: { ok: true },
        createdAt: new Date('2026-04-08T10:00:02.000Z'),
      },
      {
        id: 'l1',
        projectId: 'p1',
        method: 'GET',
        path: '/health',
        fullUrl: 'https://mock.example.com/health',
        origin: 'mock',
        statusCode: 200,
        latencyMs: 9,
        scenarioType: 'default',
        scenarioSelectionSource: 'direct-endpoint',
        scenarioName: null,
        requestHeaders: {},
        requestBody: null,
        responseHeaders: {},
        responseBody: { ok: true },
        createdAt: new Date('2026-04-08T10:00:01.000Z'),
      },
    ]);

    const response = await request(app).get('/api/v1/projects/p1/logs');

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.nextCursor).toEqual({ createdAt: '2026-04-08T10:00:02.000Z', id: 'l2' });
  });

  it('POST /api/v1/projects/:projectId/endpoints/ai-generate valida prompt corto', async () => {
    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints/ai-generate')
      .send({ prompt: 'corto' });

    expect(response.status).toBe(400);
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });

  it('POST /api/v1/projects/:projectId/endpoints/ai-generate crea endpoint generado por IA', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1' });
    prismaMock.endpoint.findFirst.mockResolvedValueOnce(null);

    openaiCreateMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
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
            }),
          },
        },
      ],
    });

    const tx = {
      endpoint: {
        create: vi.fn().mockResolvedValue({ id: 'e-ai-1' }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'e-ai-1',
          method: 'GET',
          path: '/users',
          endpointConfig: { endpointId: 'e-ai-1' },
          scenarios: [{ id: 's-ai-1', type: 'success' }],
        }),
      },
      endpointConfig: {
        create: vi.fn().mockResolvedValue({ id: 'cfg-ai-1' }),
      },
      scenario: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(async (callback) => callback(tx));

    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints/ai-generate')
      .send({ prompt: 'Generate endpoint for listing users with success scenario' });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe('e-ai-1');
    expect(response.body.scenarios).toEqual([
      expect.objectContaining({ id: 's-ai-1', type: 'success' }),
    ]);
    expect(tx.scenario.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ type: 'success' })],
      })
    );
    expect(openaiCreateMock).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/projects/:projectId/endpoints/ai-generate responde AI_TIMEOUT sin persistencia parcial', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1' });
    openaiCreateMock.mockRejectedValueOnce(
      Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
    );

    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints/ai-generate')
      .send({ prompt: 'Generate a slow endpoint that times out before persistence' });

    expect(response.status).toBe(504);
    expect(response.body).toMatchObject({
      code: 'AI_TIMEOUT',
      retryable: true,
    });
    expect(prismaMock.endpoint.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.scenario.createMany).not.toHaveBeenCalled();
  });

  it('POST /api/v1/projects/:projectId/endpoints/ai-generate responde AI_INVALID_OUTPUT sin persistencia parcial', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1' });
    openaiCreateMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              method: 'GET',
              path: '/users',
              description: 'Broken payload',
              statusCode: 200,
              responseBody: [],
              scenarios: [],
            }),
          },
        },
      ],
    });

    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints/ai-generate')
      .send({ prompt: 'Generate an endpoint with malformed AI output for runtime validation' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      code: 'AI_INVALID_OUTPUT',
      retryable: true,
    });
    expect(prismaMock.endpoint.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.scenario.createMany).not.toHaveBeenCalled();
  });

  it('POST /api/v1/projects/:projectId/endpoints/ai-preview devuelve draft normalizado sin persistir', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1' });
    openaiCreateMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              method: 'post',
              path: ' users ',
              description: 'Create user',
              statusCode: 201,
              responseBody: { id: 'u1' },
              scenarios: [
                {
                  name: 'edge case empty',
                  type: 'edge-case',
                  statusCode: 204,
                  body: [],
                  delayMs: 0,
                  weight: 1,
                },
              ],
            }),
          },
        },
      ],
    });

    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints/ai-preview')
      .send({ prompt: 'Generate a user creation endpoint preview with one empty edge case' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      method: 'POST',
      path: '/users',
      description: 'Create user',
      locks: { method: true, path: true, scenarioType: true },
      scenarios: [
        {
          name: 'edge case empty',
          type: 'empty',
          statusCode: 204,
        },
      ],
    });
    expect(prismaMock.endpoint.create).not.toHaveBeenCalled();
    expect(prismaMock.endpointConfig.create).not.toHaveBeenCalled();
    expect(prismaMock.scenario.createMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('POST /api/v1/projects/:projectId/endpoints/ai-preview responde AI_UNAVAILABLE cuando OpenAI falla', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1' });
    openaiCreateMock.mockRejectedValueOnce(new Error('upstream unavailable'));

    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints/ai-preview')
      .send({ prompt: 'Generate a user listing endpoint preview with retryable failure' });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      error: 'AI is unavailable right now',
      code: 'AI_UNAVAILABLE',
      retryable: true,
    });
  });

  it('POST /api/v1/projects/:projectId/endpoints/ai-preview responde AI_UNAVAILABLE cuando falta OPENAI_API_KEY', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1' });
    const { env } = await import('../config/env.js');
    const originalApiKey = env.OPENAI_API_KEY;
    env.OPENAI_API_KEY = undefined;

    try {
      const response = await request(app)
        .post('/api/v1/projects/p1/endpoints/ai-preview')
        .send({ prompt: 'Generate a users endpoint preview without configured OpenAI key' });

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: 'AI is unavailable right now',
        code: 'AI_UNAVAILABLE',
        retryable: false,
        details: 'OPENAI_API_KEY is not configured',
      });
      expect(openaiCreateMock).not.toHaveBeenCalled();
    } finally {
      env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it('POST /api/v1/projects/:projectId/endpoints/ai-preview responde AI_TIMEOUT cuando OpenAI agota el tiempo', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1' });
    openaiCreateMock.mockRejectedValueOnce(
      Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
    );

    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints/ai-preview')
      .send({ prompt: 'Generate a slow endpoint preview that should timeout upstream' });

    expect(response.status).toBe(504);
    expect(response.body).toMatchObject({
      error: 'AI request timed out',
      code: 'AI_TIMEOUT',
      retryable: true,
    });
  });

  it('POST /api/v1/projects/:projectId/endpoints/ai-preview responde AI_INVALID_OUTPUT cuando la salida no se puede normalizar', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1' });
    openaiCreateMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              method: 'GET',
              path: '/users',
              description: 'Broken payload',
              statusCode: 200,
              responseBody: [],
              scenarios: [],
            }),
          },
        },
      ],
    });

    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints/ai-preview')
      .send({ prompt: 'Generate a users endpoint preview with malformed AI output' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: 'AI returned invalid output',
      code: 'AI_INVALID_OUTPUT',
      retryable: true,
    });
  });
});
