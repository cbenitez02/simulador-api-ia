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
});
