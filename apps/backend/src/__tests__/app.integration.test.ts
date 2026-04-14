import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import { resetRateLimitStoreForTests } from '../mock-server/rate-limit.js';

const openaiCreateMock = vi.fn();
const runtimeRateLimitBuckets = new Map<string, { requestCount: number }>();

const prismaMock = {
  user: {
    create: vi.fn(),
    update: vi.fn(),
  },
  workspace: {
    create: vi.fn(),
  },
  workspaceMembership: {
    create: vi.fn(),
  },
  externalIdentity: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  project: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  endpoint: {
    findMany: vi.fn(),
    count: vi.fn(),
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
    aggregate: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
    deleteMany: vi.fn(),
  },
  runtimeRateLimitBucket: {
    upsert: vi.fn(),
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

function authHeaders(overrides: Record<string, string> = {}) {
  return {
    'x-clerk-auth-status': 'signed-in',
    'x-clerk-user-id': 'user_clerk_123',
    'x-clerk-email': 'owner@example.com',
    'x-clerk-email-verified': 'true',
    'x-clerk-display-name': 'Owner User',
    ...overrides,
  };
}

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

function resetNestedMocks(group: Record<string, unknown>) {
  for (const value of Object.values(group)) {
    if (typeof value === 'function' && 'mockReset' in value) {
      (value as { mockReset: () => void }).mockReset();
    }
  }
}

describe('app integration', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://user:password@localhost:5432/simulador_api_ia_test';
    process.env.OPENAI_MODEL ??= 'gpt-4.1-mini';

    ({ app } = await import('../app.js'));
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    resetNestedMocks(prismaMock.user);
    resetNestedMocks(prismaMock.workspace);
    resetNestedMocks(prismaMock.workspaceMembership);
    resetNestedMocks(prismaMock.externalIdentity);
    resetNestedMocks(prismaMock.project);
    resetNestedMocks(prismaMock.endpoint);
    resetNestedMocks(prismaMock.scenario);
    resetNestedMocks(prismaMock.endpointConfig);
    resetNestedMocks(prismaMock.globalConfig);
    resetNestedMocks(prismaMock.apiLog);
    resetNestedMocks(prismaMock.runtimeRateLimitBucket);
    prismaMock.$transaction.mockReset();
    openaiCreateMock.mockReset();
    resetRateLimitStoreForTests();
    runtimeRateLimitBuckets.clear();
    prismaMock.runtimeRateLimitBucket.upsert.mockImplementation(
      async ({ where, create, update }) => {
        const key = `${where.projectId_windowStart.projectId}:${new Date(where.projectId_windowStart.windowStart).toISOString()}`;
        const current = runtimeRateLimitBuckets.get(key);

        if (current) {
          current.requestCount += update.requestCount.increment;
          return {
            projectId: where.projectId_windowStart.projectId,
            windowStart: where.projectId_windowStart.windowStart,
            requestCount: current.requestCount,
            updatedAt: new Date(),
          };
        }

        const created = {
          projectId: create.projectId,
          windowStart: create.windowStart,
          requestCount: create.requestCount,
          updatedAt: new Date(),
        };

        runtimeRateLimitBuckets.set(key, { requestCount: created.requestCount });
        return created;
      }
    );
    prismaMock.project.findUnique.mockResolvedValue({ id: 'p1', workspaceId: 'workspace-1' });
    prismaMock.endpoint.findUnique.mockResolvedValue({
      id: 'e1',
      projectId: 'p1',
      project: { workspaceId: 'workspace-1' },
    });
    prismaMock.externalIdentity.findUnique.mockResolvedValue({
      provider: 'clerk',
      subject: 'user_clerk_123',
      email: 'owner@example.com',
      emailVerified: true,
      displayName: 'Owner User',
      userId: 'user-1',
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        displayName: 'Owner User',
        memberships: [{ workspaceId: 'workspace-1', role: 'owner' }],
        personalWorkspace: { id: 'workspace-1' },
      },
    });
  });

  it('rechaza /api/v1 sin identidad autenticada', async () => {
    const response = await request(app).get('/api/v1/projects');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
    expect(prismaMock.project.findMany).not.toHaveBeenCalled();
  });

  it('propaga X-Request-Id al health operativo', async () => {
    prismaMock.project.count = vi.fn().mockResolvedValueOnce(2);
    prismaMock.endpoint.count = vi.fn().mockResolvedValueOnce(5);
    prismaMock.apiLog.count = vi.fn().mockResolvedValueOnce(11);

    const response = await request(app).get('/ops/health').set('X-Request-Id', 'req-123');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('req-123');
    expect(response.body).toMatchObject({
      ok: true,
      service: 'backend',
      metrics: {
        projects: 2,
        endpoints: 5,
        logs: 11,
      },
    });
  });

  it('genera X-Request-Id cuando no viene en el request', async () => {
    prismaMock.project.count = vi.fn().mockResolvedValueOnce(0);
    prismaMock.endpoint.count = vi.fn().mockResolvedValueOnce(0);
    prismaMock.apiLog.count = vi.fn().mockResolvedValueOnce(0);

    const response = await request(app).get('/ops/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('permite origen localhost en desarrollo cuando no hay CORS_ALLOWED_ORIGINS explícito', async () => {
    const { env } = await import('../config/env.js');
    const originalNodeEnv = env.NODE_ENV;
    const originalAllowedOrigins = env.CORS_ALLOWED_ORIGINS;
    env.NODE_ENV = 'development';
    env.CORS_ALLOWED_ORIGINS = undefined;

    try {
      const response = await request(app)
        .options('/api/v1/projects')
        .set('Origin', 'http://127.0.0.1:4200')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:4200');
    } finally {
      env.NODE_ENV = originalNodeEnv;
      env.CORS_ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it('bloquea orígenes arbitrarios en producción cuando no hay allowlist explícita', async () => {
    const { env } = await import('../config/env.js');
    const originalNodeEnv = env.NODE_ENV;
    const originalAllowedOrigins = env.CORS_ALLOWED_ORIGINS;
    env.NODE_ENV = 'production';
    env.CORS_ALLOWED_ORIGINS = undefined;

    try {
      const response = await request(app)
        .options('/api/v1/projects')
        .set('Origin', 'https://evil.example.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBe(401);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      env.NODE_ENV = originalNodeEnv;
      env.CORS_ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it('permite sólo los orígenes configurados cuando existe allowlist explícita', async () => {
    const { env } = await import('../config/env.js');
    const originalNodeEnv = env.NODE_ENV;
    const originalAllowedOrigins = env.CORS_ALLOWED_ORIGINS;
    env.NODE_ENV = 'production';
    env.CORS_ALLOWED_ORIGINS = ['https://app.example.com'];

    try {
      const allowedResponse = await request(app)
        .options('/api/v1/projects')
        .set('Origin', 'https://app.example.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(allowedResponse.status).toBe(204);
      expect(allowedResponse.headers['access-control-allow-origin']).toBe(
        'https://app.example.com'
      );

      const blockedResponse = await request(app)
        .options('/api/v1/projects')
        .set('Origin', 'https://other.example.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(blockedResponse.status).toBe(401);
      expect(blockedResponse.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      env.NODE_ENV = originalNodeEnv;
      env.CORS_ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it('GET /api/v1/projects responde una página filtrada y estable', async () => {
    prismaMock.project.findMany.mockResolvedValueOnce([
      {
        id: 'p2',
        name: 'Proyecto 2',
        slug: 'proyecto-2',
        description: '',
        updatedAt: new Date('2026-04-08T10:00:00.000Z'),
        _count: { endpoints: 3 },
      },
    ]);
    prismaMock.project.count.mockResolvedValueOnce(7);

    const response = await request(app)
      .get('/api/v1/projects?limit=10&offset=5&q=yecto')
      .set(authHeaders());

    expect(response.status).toBe(200);
    expect(response.body.page).toEqual({ limit: 10, offset: 5, total: 7, hasMore: true });
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].slug).toBe('proyecto-2');
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: 5,
        take: 10,
      })
    );
    expect(prismaMock.project.count).toHaveBeenCalledTimes(1);
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

    const response = await request(app)
      .post('/api/v1/projects')
      .set(authHeaders())
      .send({ name: 'Mi API' });

    expect(response.status).toBe(201);
    expect(response.body.slug).toBe('mi-api');
    expect(tx.globalConfig.create).toHaveBeenCalledTimes(1);
  });

  it('PATCH /api/v1/projects/:projectId actualiza metadata sin cambiar slug', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
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
      .set(authHeaders())
      .send({ name: 'Mi API v2', description: 'Nuevo texto' });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Mi API v2');
    expect(response.body.slug).toBe('mi-api');
  });

  it('PATCH /api/v1/projects/:projectId responde 404 si el proyecto no existe', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce(null);

    const response = await request(app)
      .patch('/api/v1/projects/p404')
      .set(authHeaders())
      .send({ name: 'Ghost project' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Project not found');
  });

  it('DELETE /api/v1/projects/:projectId responde 204 sin body', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
    prismaMock.project.delete.mockResolvedValueOnce({ id: 'p1' });

    const response = await request(app).delete('/api/v1/projects/p1').set(authHeaders());

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
  });

  it('DELETE /api/v1/projects/:projectId responde 404 si el proyecto no existe', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce(null);

    const response = await request(app).delete('/api/v1/projects/p404').set(authHeaders());

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Project not found');
  });

  it('POST /api/v1/projects/:projectId/endpoints responde 409 si ya existe', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
    prismaMock.endpoint.findFirst.mockResolvedValueOnce({ id: 'e1' });

    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints')
      .set(authHeaders())
      .send({ method: 'GET', path: '/users' });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/already exists/i);
  });

  it('GET /api/v1/projects/:projectId/endpoints responde una página con filtros y orden estable', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
    prismaMock.endpoint.findMany.mockResolvedValueOnce([
      {
        id: 'e2',
        projectId: 'p1',
        method: 'GET',
        path: '/users',
        description: 'List users',
        statusCode: 200,
        updatedAt: new Date('2026-04-08T10:00:00.000Z'),
        endpointConfig: { latencyMode: 'range', fixedDelayMs: 0, minDelayMs: 50, maxDelayMs: 150 },
        _count: { scenarios: 2 },
      },
    ]);
    prismaMock.endpoint.count.mockResolvedValueOnce(3);

    const response = await request(app)
      .get('/api/v1/projects/p1/endpoints?limit=1&offset=1&q=user&method=get&sort=method')
      .set(authHeaders());

    expect(response.status).toBe(200);
    expect(response.body.page).toEqual({ limit: 1, offset: 1, total: 3, hasMore: true });
    expect(response.body.items).toEqual([
      {
        id: 'e2',
        projectId: 'p1',
        method: 'GET',
        path: '/users',
        description: 'List users',
        statusCode: 200,
        updatedAt: '2026-04-08T10:00:00.000Z',
        scenarioCount: 2,
        latencyMs: 100,
      },
    ]);
    expect(prismaMock.endpoint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ method: 'asc' }, { path: 'asc' }, { id: 'asc' }],
        skip: 1,
        take: 1,
      })
    );
  });

  it('POST /api/v1/endpoints/:endpointId/scenarios crea scenario', async () => {
    prismaMock.endpoint.findUnique.mockResolvedValueOnce({
      id: 'e1',
      projectId: 'p1',
      project: { workspaceId: 'workspace-1' },
    });
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
      .set(authHeaders())
      .send({ name: 'ok', type: 'success', statusCode: 200, body: { ok: true } });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe('s1');
  });

  it('GET /api/v1/projects/:projectId/dashboard-summary devuelve summary real agregado', async () => {
    const { env } = await import('../config/env.js');
    const originalMockBaseUrl = env.MOCK_BASE_URL;
    env.MOCK_BASE_URL = 'https://mock.example.com/public-base';

    try {
      prismaMock.project.findUnique.mockResolvedValueOnce({
        id: 'p1',
        workspaceId: 'workspace-1',
        name: 'Proyecto',
        slug: 'proyecto',
        description: 'Demo',
        updatedAt: new Date('2026-04-08T10:00:00.000Z'),
        globalConfig: {
          latencyEnabled: false,
          latencyMinMs: 0,
          latencyMaxMs: 1000,
          latencyMode: 'fixed',
          errorSimulationEnabled: true,
          errorSimulationRate: 0.1,
          errorSimulationCodes: [500],
          rateLimitingEnabled: true,
          rateLimitingRpm: 120,
          loggingLevel: 'full',
          scope: 'all',
        },
        endpoints: [
          {
            id: 'e1',
            method: 'GET',
            path: '/users',
            description: 'List users',
            endpointConfig: {
              latencyMode: 'fixed',
              fixedDelayMs: 90,
              minDelayMs: 0,
              maxDelayMs: 0,
            },
            scenarios: [
              { id: 's1', type: 'success' },
              { id: 's2', type: 'error' },
            ],
          },
          {
            id: 'e2',
            method: 'POST',
            path: '/users',
            description: 'Create user',
            endpointConfig: null,
            scenarios: [],
          },
        ],
      });
      prismaMock.apiLog.aggregate.mockResolvedValueOnce({
        _count: { _all: 4 },
        _avg: { latencyMs: 120 },
      });
      prismaMock.apiLog.count.mockResolvedValueOnce(1);
      prismaMock.apiLog.findMany.mockResolvedValueOnce([
        {
          id: 'log-1',
          method: 'GET',
          path: '/users',
          statusCode: 500,
          latencyMs: 140,
          scenarioType: 'error',
          createdAt: new Date('2026-04-08T11:00:00.000Z'),
        },
      ]);
      prismaMock.apiLog.groupBy
        .mockResolvedValueOnce([
          {
            method: 'GET',
            path: '/users',
            _count: { _all: 2 },
            _avg: { latencyMs: 120 },
          },
        ])
        .mockResolvedValueOnce([
          {
            method: 'GET',
            path: '/users',
            _count: { _all: 1 },
          },
        ]);

      const response = await request(app)
        .get('/api/v1/projects/p1/dashboard-summary')
        .set(authHeaders());

      expect(response.status).toBe(200);
      expect(response.body.project).toEqual({
        id: 'p1',
        name: 'Proyecto',
        description: 'Demo',
        slug: 'proyecto',
        mockUrl: 'https://mock.example.com/public-base/proyecto',
        updatedAt: '2026-04-08T10:00:00.000Z',
        status: 'attention',
      });
      expect(response.body.metrics).toEqual({
        totalEndpoints: 2,
        totalScenarios: 2,
        avgLatencyMs: 120,
        errorRatePct: 25,
        totalRequests: 4,
      });
      expect(response.body.health).toEqual({
        readyEndpoints: 1,
        needsAttentionEndpoints: 1,
        errorScenarioEndpoints: 1,
        emptyScenarioEndpoints: 0,
        timeoutScenarioEndpoints: 0,
      });
      expect(response.body.endpointRows).toEqual([
        {
          endpointId: 'e1',
          method: 'GET',
          path: '/users',
          description: 'List users',
          scenarioCount: 2,
          latencyMs: 120,
          errorRatePct: 50,
          status: 'ready',
        },
        {
          endpointId: 'e2',
          method: 'POST',
          path: '/users',
          description: 'Create user',
          scenarioCount: 0,
          latencyMs: 0,
          errorRatePct: 0,
          status: 'needs-attention',
        },
      ]);
      expect(response.body.recentRequests).toEqual([
        {
          id: 'log-1',
          method: 'GET',
          path: '/users',
          statusCode: 500,
          latencyMs: 140,
          scenarioType: 'error',
          createdAt: '2026-04-08T11:00:00.000Z',
        },
      ]);
      expect(response.body.configSummary).toEqual({
        latency: { enabled: false, mode: 'fixed', minMs: 0, maxMs: 1000 },
        errorSimulation: { enabled: true, ratePct: 10, codes: [500] },
        rateLimiting: { enabled: true, rpm: 120 },
        logging: { level: 'full' },
        scope: 'all',
      });
      expect(prismaMock.apiLog.findMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.apiLog.groupBy).toHaveBeenCalledTimes(2);
    } finally {
      env.MOCK_BASE_URL = originalMockBaseUrl;
    }
  });

  it('GET /api/v1/projects/:projectId/dashboard-summary responde 404 cuando falta el proyecto', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce(null);

    const response = await request(app)
      .get('/api/v1/projects/p404/dashboard-summary')
      .set(authHeaders());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Project not found' });
  });

  it('GET /api/v1/projects/:projectId/dashboard-summary devuelve recientes vacíos y config default sin logs', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({
      id: 'p1',
      workspaceId: 'workspace-1',
      name: 'Proyecto vacío',
      slug: 'proyecto-vacio',
      description: '',
      updatedAt: new Date('2026-04-08T10:00:00.000Z'),
      globalConfig: null,
      endpoints: [],
    });
    prismaMock.apiLog.aggregate.mockResolvedValueOnce({
      _count: { _all: 0 },
      _avg: { latencyMs: null },
    });
    prismaMock.apiLog.count.mockResolvedValueOnce(0);
    prismaMock.apiLog.findMany.mockResolvedValueOnce([]);
    prismaMock.apiLog.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const response = await request(app)
      .get('/api/v1/projects/p1/dashboard-summary')
      .set(authHeaders());

    expect(response.status).toBe(200);
    expect(response.body.project.status).toBe('empty');
    expect(response.body.metrics).toEqual({
      totalEndpoints: 0,
      totalScenarios: 0,
      avgLatencyMs: 0,
      errorRatePct: 0,
      totalRequests: 0,
    });
    expect(response.body.recentRequests).toEqual([]);
    expect(response.body.configSummary).toEqual({
      latency: { enabled: false, mode: 'fixed', minMs: 0, maxMs: 1000 },
      errorSimulation: { enabled: false, ratePct: 0, codes: [500] },
      rateLimiting: { enabled: false, rpm: 60 },
      logging: { level: 'basic' },
      scope: 'all',
    });
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

  it('PUT /api/v1/projects/:projectId/config canonicaliza scope no soportado a all', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
    prismaMock.globalConfig.upsert.mockResolvedValueOnce({
      projectId: 'p1',
      latencyEnabled: false,
      latencyMinMs: 0,
      latencyMaxMs: 1000,
      latencyMode: 'fixed',
      errorSimulationEnabled: false,
      errorSimulationRate: 0,
      errorSimulationCodes: [500],
      rateLimitingEnabled: false,
      rateLimitingRpm: 60,
      loggingLevel: 'basic',
      scope: 'all',
    });

    const response = await request(app)
      .put('/api/v1/projects/p1/config')
      .set(authHeaders())
      .send({
        latencyEnabled: false,
        latencyMinMs: 0,
        latencyMaxMs: 1000,
        latencyMode: 'fixed',
        errorSimulationEnabled: false,
        errorSimulationRate: 0,
        errorSimulationCodes: [500],
        rateLimitingEnabled: false,
        rateLimitingRpm: 60,
        loggingLevel: 'basic',
        scope: 'unset',
      });

    expect(response.status).toBe(200);
    expect(prismaMock.globalConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ scope: 'all' }),
        create: expect.objectContaining({ scope: 'all' }),
      })
    );
    expect(response.body.scope).toBe('all');
  });

  it('PUT /api/v1/endpoints/:endpointId/config canonicaliza errorRate no soportado a 0', async () => {
    prismaMock.endpoint.findUnique.mockResolvedValueOnce({
      id: 'e1',
      projectId: 'p1',
      project: { workspaceId: 'workspace-1' },
    });
    prismaMock.endpointConfig.upsert.mockResolvedValueOnce({
      endpointId: 'e1',
      latencyMode: 'range',
      fixedDelayMs: 0,
      minDelayMs: 50,
      maxDelayMs: 250,
      errorRate: 0,
      useScenarioWeights: false,
    });

    const response = await request(app).put('/api/v1/endpoints/e1/config').set(authHeaders()).send({
      latencyMode: 'range',
      fixedDelayMs: 0,
      minDelayMs: 50,
      maxDelayMs: 250,
      errorRate: 0.35,
      useScenarioWeights: false,
    });

    expect(response.status).toBe(200);
    expect(prismaMock.endpointConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ errorRate: 0 }),
        create: expect.objectContaining({ errorRate: 0 }),
      })
    );
    expect(response.body.errorRate).toBe(0);
  });

  it('GET /mock/:projectSlug/:path aplica latencia global aunque exista scope legacy distinto de all', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce(
      buildMockProject({
        globalConfig: {
          ...buildMockProject().globalConfig,
          latencyEnabled: true,
          latencyMode: 'fixed',
          latencyMinMs: 123,
          latencyMaxMs: 456,
          scope: 'unset',
        },
      })
    );
    prismaMock.endpoint.findFirst.mockResolvedValueOnce(
      buildMockEndpoint({
        endpointConfig: {
          latencyMode: 'fixed',
          fixedDelayMs: 25,
          minDelayMs: 0,
          maxDelayMs: 25,
          useScenarioWeights: true,
        },
      })
    );
    prismaMock.apiLog.create.mockResolvedValueOnce({ id: 'l1' });

    const response = await request(app).get('/mock/demo/users');

    expect(response.status).toBe(200);
    expect(response.headers['x-simulador-latency']).toBe('123');
  });

  it('GET /api/v1/projects/:projectId/logs devuelve últimos logs', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
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

    const response = await request(app).get('/api/v1/projects/p1/logs').set(authHeaders());

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.nextCursor).toEqual({ createdAt: '2026-04-08T10:00:02.000Z', id: 'l2' });
  });

  it('POST /api/v1/projects/:projectId/endpoints/ai-generate valida prompt corto', async () => {
    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints/ai-generate')
      .set(authHeaders())
      .send({ prompt: 'corto' });

    expect(response.status).toBe(400);
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });

  it('POST /api/v1/projects/:projectId/endpoints/ai-generate crea endpoint generado por IA', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
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
      .set(authHeaders())
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
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
    openaiCreateMock.mockRejectedValueOnce(
      Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
    );

    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints/ai-generate')
      .set(authHeaders())
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
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
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
      .set(authHeaders())
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
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
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
      .set(authHeaders())
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
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
    openaiCreateMock.mockRejectedValueOnce(new Error('upstream unavailable'));

    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints/ai-preview')
      .set(authHeaders())
      .send({ prompt: 'Generate a user listing endpoint preview with retryable failure' });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      error: 'AI is unavailable right now',
      code: 'AI_UNAVAILABLE',
      retryable: true,
    });
  });

  it('POST /api/v1/projects/:projectId/endpoints/ai-preview responde AI_UNAVAILABLE cuando falta OPENAI_API_KEY', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
    const { env } = await import('../config/env.js');
    const originalApiKey = env.OPENAI_API_KEY;
    env.OPENAI_API_KEY = undefined;

    try {
      const response = await request(app)
        .post('/api/v1/projects/p1/endpoints/ai-preview')
        .set(authHeaders())
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
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
    openaiCreateMock.mockRejectedValueOnce(
      Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
    );

    const response = await request(app)
      .post('/api/v1/projects/p1/endpoints/ai-preview')
      .set(authHeaders())
      .send({ prompt: 'Generate a slow endpoint preview that should timeout upstream' });

    expect(response.status).toBe(504);
    expect(response.body).toMatchObject({
      error: 'AI request timed out',
      code: 'AI_TIMEOUT',
      retryable: true,
    });
  });

  it('POST /api/v1/projects/:projectId/endpoints/ai-preview responde AI_INVALID_OUTPUT cuando la salida no se puede normalizar', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'p1', workspaceId: 'workspace-1' });
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
      .set(authHeaders())
      .send({ prompt: 'Generate a users endpoint preview with malformed AI output' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: 'AI returned invalid output',
      code: 'AI_INVALID_OUTPUT',
      retryable: true,
    });
  });
});
