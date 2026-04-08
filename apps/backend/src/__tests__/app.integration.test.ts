import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';

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

describe('app integration', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://user:password@localhost:5432/simulador_api_ia_test';
    process.env.OPENAI_API_KEY ??= 'test-key';
    process.env.OPENAI_MODEL ??= 'gpt-4.1-mini';

    ({ app } = await import('../app.js'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
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
    prismaMock.project.findUnique.mockResolvedValueOnce({
      id: 'p1',
      globalConfig: {
        latencyEnabled: false,
        latencyMode: 'fixed',
        latencyMinMs: 0,
        latencyMaxMs: 0,
        scope: 'all',
        errorSimulationEnabled: false,
        errorSimulationRate: 0,
        errorSimulationCodes: [500],
      },
    });

    prismaMock.endpoint.findFirst.mockResolvedValueOnce({
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
    });

    prismaMock.apiLog.create.mockResolvedValueOnce({ id: 'l1' });

    const response = await request(app).get('/mock/demo/users');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers['x-simulador-scenario']).toBe('direct');
    expect(prismaMock.apiLog.create).toHaveBeenCalledTimes(1);
  });

  it('GET /api/v1/projects/:projectId/logs devuelve últimos logs', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1' });
    prismaMock.apiLog.findMany.mockResolvedValueOnce([
      { id: 'l1', projectId: 'p1' },
      { id: 'l2', projectId: 'p1' },
    ]);

    const response = await request(app).get('/api/v1/projects/p1/logs');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
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
          scenarios: [{ id: 's-ai-1' }],
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
    expect(openaiCreateMock).toHaveBeenCalledTimes(1);
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
      locks: { method: true, path: true },
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
