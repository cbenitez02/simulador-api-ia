import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, describe, expect, it, afterAll, beforeEach } from 'vitest';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';

const runDbTests = process.env.RUN_DB_TESTS === 'true';
const describeDb = runDbTests ? describe : describe.skip;

let app: Express;
let prisma: PrismaClient;
let prismaJsonNull: Prisma.NullableJsonNullValueInput;

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

function apiGet(appInstance: Express, path: string) {
  return request(appInstance).get(path).set(authHeaders());
}

function apiPost(appInstance: Express, path: string) {
  return request(appInstance).post(path).set(authHeaders());
}

function apiPut(appInstance: Express, path: string) {
  return request(appInstance).put(path).set(authHeaders());
}

function apiDelete(appInstance: Express, path: string) {
  return request(appInstance).delete(path).set(authHeaders());
}

async function cleanDatabase() {
  await prisma.apiLog.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.endpointConfig.deleteMany();
  await prisma.endpoint.deleteMany();
  await prisma.globalConfig.deleteMany();
  await prisma.project.deleteMany();
  await prisma.externalIdentity.deleteMany();
  await prisma.workspaceMembership.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
}

interface LogListResponse {
  items: Array<{
    id: string;
    path: string;
    fullUrl: string;
    origin: string;
    scenarioType: string;
    scenarioSelectionSource: string;
    scenarioName: string | null;
    hasScenario: boolean;
    requestBody: unknown;
    responseBody: unknown;
    createdAt: string;
  }>;
  nextCursor: { createdAt: string; id: string } | null;
  serverTime: string;
}

async function waitForLogEntries(
  appInstance: Express,
  projectId: string,
  timeoutMs = 3000,
  minCount = 1
): Promise<LogListResponse['items']> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await apiGet(appInstance, `/api/v1/projects/${projectId}/logs`);

    if (
      response.status === 200 &&
      response.body &&
      Array.isArray(response.body.items) &&
      response.body.items.length >= minCount
    ) {
      return response.body.items;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  return [];
}

describeDb('db integration (real postgres)', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL ??=
      'postgresql://postgres:postgres@localhost:54329/simulador_api_test?schema=public';
    process.env.OPENAI_MODEL ??= 'gpt-4.1-mini';

    ({ app } = await import('../app.js'));
    ({ prisma } = await import('../lib/prisma.js'));
    ({
      Prisma: { JsonNull: prismaJsonNull },
    } = await import('../generated/prisma/client.js'));
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('crea proyecto y persiste globalConfig default', async () => {
    const response = await apiPost(app, '/api/v1/projects').send({
      name: 'Proyecto DB Real',
      description: 'Test con postgres real',
    });

    expect(response.status).toBe(201);
    expect(response.body.slug).toBe('proyecto-db-real');

    const savedProject = await prisma.project.findUnique({
      where: { id: response.body.id },
      include: { globalConfig: true },
    });

    expect(savedProject?.globalConfig).not.toBeNull();
    expect(savedProject?.globalConfig?.loggingLevel).toBe('basic');
  });

  it('soporta ownership por workspace y enlaces de identidad externos sin acoplarse a Clerk', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'owner@example.com',
        displayName: 'Owner User',
      },
    });

    const workspace = await prisma.workspace.create({
      data: {
        name: 'Owner Personal Workspace',
        kind: 'personal',
        personalForUserId: user.id,
      },
    });

    await prisma.workspaceMembership.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'owner',
      },
    });

    await prisma.externalIdentity.create({
      data: {
        userId: user.id,
        provider: 'clerk',
        subject: 'user_clerk_123',
        email: 'owner@example.com',
        emailVerified: true,
        displayName: 'Owner User',
      },
    });

    const project = await prisma.project.create({
      data: {
        name: 'Workspace Owned Project',
        slug: 'workspace-owned-project',
        description: 'Ownership foundation test',
        workspaceId: workspace.id,
      },
    });

    const savedWorkspace = await prisma.workspace.findUnique({
      where: { id: workspace.id },
      include: {
        personalForUser: true,
        memberships: true,
        projects: true,
      },
    });

    const savedIdentity = await prisma.externalIdentity.findUnique({
      where: {
        provider_subject: {
          provider: 'clerk',
          subject: 'user_clerk_123',
        },
      },
    });

    expect(savedWorkspace?.kind).toBe('personal');
    expect(savedWorkspace?.personalForUser?.id).toBe(user.id);
    expect(savedWorkspace?.memberships).toHaveLength(1);
    expect(savedWorkspace?.memberships[0]?.role).toBe('owner');
    expect(savedWorkspace?.projects).toHaveLength(1);
    expect(savedWorkspace?.projects[0]?.id).toBe(project.id);
    expect(savedIdentity?.provider).toBe('clerk');
    expect(savedIdentity?.subject).toBe('user_clerk_123');
  });

  it('flujo real de endpoint + scenario + mock + logs', async () => {
    const projectRes = await apiPost(app, '/api/v1/projects').send({ name: 'Demo Mock' });
    expect(projectRes.status).toBe(201);

    const endpointRes = await apiPost(app, `/api/v1/projects/${projectRes.body.id}/endpoints`).send(
      {
        method: 'GET',
        path: '/users',
        statusCode: 200,
        responseBody: { source: 'endpoint-default' },
      }
    );

    expect(endpointRes.status).toBe(201);

    const scenarioRes = await apiPost(
      app,
      `/api/v1/endpoints/${endpointRes.body.id}/scenarios`
    ).send({
      name: 'success-case',
      type: 'success',
      statusCode: 200,
      body: { source: 'scenario' },
      weight: 1,
    });

    expect(scenarioRes.status).toBe(201);

    const mockRes = await request(app).get(`/mock/${projectRes.body.slug}/users`);
    expect(mockRes.status).toBe(200);
    expect(mockRes.body).toEqual({ source: 'scenario' });
    expect(mockRes.headers['x-simulador-scenario']).toBe('success-case');

    const logs = await waitForLogEntries(app, projectRes.body.id);
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
  });

  it('lista logs con envelope incremental, orden estable y cursor por tupla', async () => {
    const projectRes = await apiPost(app, '/api/v1/projects').send({ name: 'Live Logs Order' });
    expect(projectRes.status).toBe(201);

    await prisma.apiLog.createMany({
      data: [
        {
          id: 'log-older',
          projectId: projectRes.body.id,
          method: 'GET',
          path: '/older',
          fullUrl: 'https://mock.example.com/older',
          origin: 'mock',
          statusCode: 200,
          latencyMs: 10,
          scenarioType: 'success',
          scenarioSelectionSource: 'direct-endpoint',
          scenarioName: null,
          requestHeaders: {},
          requestBody: prismaJsonNull,
          responseHeaders: {},
          responseBody: { ok: true },
          createdAt: new Date('2026-04-08T12:00:00.000Z'),
        },
        {
          id: 'log-same-a',
          projectId: projectRes.body.id,
          method: 'GET',
          path: '/same-a',
          fullUrl: 'https://mock.example.com/same-a',
          origin: 'mock',
          statusCode: 201,
          latencyMs: 11,
          scenarioType: 'success',
          scenarioSelectionSource: 'direct-endpoint',
          scenarioName: null,
          requestHeaders: {},
          requestBody: prismaJsonNull,
          responseHeaders: {},
          responseBody: { ok: 'a' },
          createdAt: new Date('2026-04-08T12:01:00.000Z'),
        },
        {
          id: 'log-same-b',
          projectId: projectRes.body.id,
          method: 'GET',
          path: '/same-b',
          fullUrl: 'https://mock.example.com/same-b',
          origin: 'mock',
          statusCode: 202,
          latencyMs: 12,
          scenarioType: 'success',
          scenarioSelectionSource: 'direct-endpoint',
          scenarioName: null,
          requestHeaders: {},
          requestBody: prismaJsonNull,
          responseHeaders: {},
          responseBody: { ok: 'b' },
          createdAt: new Date('2026-04-08T12:01:00.000Z'),
        },
      ],
    });

    const firstResponse = await apiGet(app, `/api/v1/projects/${projectRes.body.id}/logs?limit=2`);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.items.map((item: { id: string }) => item.id)).toEqual([
      'log-same-b',
      'log-same-a',
    ]);
    expect(firstResponse.body.nextCursor).toEqual({
      createdAt: '2026-04-08T12:01:00.000Z',
      id: 'log-same-b',
    });
    expect(typeof firstResponse.body.serverTime).toBe('string');

    const incrementalResponse = await apiGet(
      app,
      `/api/v1/projects/${projectRes.body.id}/logs?cursorCreatedAt=${encodeURIComponent('2026-04-08T12:01:00.000Z')}&cursorId=log-same-a`
    );

    expect(incrementalResponse.status).toBe(200);
    expect(incrementalResponse.body.items.map((item: { id: string }) => item.id)).toEqual([
      'log-same-b',
    ]);
    expect(incrementalResponse.body.nextCursor).toEqual({
      createdAt: '2026-04-08T12:01:00.000Z',
      id: 'log-same-b',
    });
  });

  it('forced-error global responde código configurado', async () => {
    const projectRes = await apiPost(app, '/api/v1/projects').send({ name: 'Forced Error' });
    expect(projectRes.status).toBe(201);

    const endpointRes = await apiPost(app, `/api/v1/projects/${projectRes.body.id}/endpoints`).send(
      { method: 'GET', path: '/healthz', statusCode: 200, responseBody: { ok: true } }
    );
    expect(endpointRes.status).toBe(201);

    const cfgRes = await apiPut(app, `/api/v1/projects/${projectRes.body.id}/config`).send({
      latencyEnabled: false,
      latencyMinMs: 0,
      latencyMaxMs: 0,
      latencyMode: 'fixed',
      errorSimulationEnabled: true,
      errorSimulationRate: 1,
      errorSimulationCodes: [503],
      rateLimitingEnabled: false,
      rateLimitingRpm: 60,
      loggingLevel: 'basic',
      scope: 'all',
    });

    expect(cfgRes.status).toBe(200);

    const mockRes = await request(app).get(`/mock/${projectRes.body.slug}/healthz`);
    expect(mockRes.status).toBe(503);
  });

  it('persiste y expone metadata real de trazabilidad sin inventar scenario', async () => {
    const projectRes = await apiPost(app, '/api/v1/projects').send({ name: 'Traceability Logs' });
    expect(projectRes.status).toBe(201);

    const scenarioEndpointRes = await apiPost(
      app,
      `/api/v1/projects/${projectRes.body.id}/endpoints`
    ).send({
      method: 'POST',
      path: '/users',
      statusCode: 201,
      responseBody: { source: 'endpoint-default' },
    });
    expect(scenarioEndpointRes.status).toBe(201);

    const scenarioRes = await apiPost(
      app,
      `/api/v1/endpoints/${scenarioEndpointRes.body.id}/scenarios`
    ).send({
      name: 'create-user',
      type: 'success',
      statusCode: 201,
      body: { ok: true },
      delayMs: 0,
      weight: 1,
    });
    expect(scenarioRes.status).toBe(201);

    const directEndpointRes = await apiPost(
      app,
      `/api/v1/projects/${projectRes.body.id}/endpoints`
    ).send({ method: 'GET', path: '/health', statusCode: 200, responseBody: { ok: true } });
    expect(directEndpointRes.status).toBe(201);

    const scenarioMockRes = await request(app)
      .post(`/mock/${projectRes.body.slug}/users?draft=true`)
      .set('host', 'simulator.local')
      .send({ name: 'Ada' });
    expect(scenarioMockRes.status).toBe(201);

    const directMockRes = await request(app)
      .get(`/mock/${projectRes.body.slug}/health?draft=true`)
      .set('host', 'simulator.local');
    expect(directMockRes.status).toBe(200);

    const logs = await waitForLogEntries(app, projectRes.body.id);
    expect(logs).toHaveLength(2);

    const scenarioLog = logs.find((log) => log.path === '/users');
    const directLog = logs.find((log) => log.path === '/health');

    expect(scenarioLog).toMatchObject({
      fullUrl: 'http://simulator.local/mock/traceability-logs/users?draft=true',
      origin: 'mock',
      scenarioType: 'success',
      scenarioSelectionSource: 'weighted-random',
      scenarioName: 'create-user',
      hasScenario: true,
    });

    expect(directLog).toMatchObject({
      fullUrl: 'http://simulator.local/mock/traceability-logs/health?draft=true',
      origin: 'mock',
      scenarioType: 'default',
      scenarioSelectionSource: 'direct-endpoint',
      scenarioName: null,
      hasScenario: false,
    });
  });

  it('respeta loggingLevel basic omitiendo request y response bodies', async () => {
    const projectRes = await apiPost(app, '/api/v1/projects').send({ name: 'Basic Logging' });
    expect(projectRes.status).toBe(201);

    const configRes = await apiPut(app, `/api/v1/projects/${projectRes.body.id}/config`).send({
      latencyEnabled: false,
      latencyMinMs: 0,
      latencyMaxMs: 0,
      latencyMode: 'fixed',
      errorSimulationEnabled: false,
      errorSimulationRate: 0,
      errorSimulationCodes: [500],
      rateLimitingEnabled: false,
      rateLimitingRpm: 60,
      loggingLevel: 'basic',
      scope: 'all',
    });
    expect(configRes.status).toBe(200);

    const endpointRes = await apiPost(app, `/api/v1/projects/${projectRes.body.id}/endpoints`).send(
      {
        method: 'POST',
        path: '/users',
        statusCode: 201,
        responseBody: { created: true, secret: 'server-payload' },
      }
    );
    expect(endpointRes.status).toBe(201);

    const mockRes = await request(app)
      .post(`/mock/${projectRes.body.slug}/users`)
      .send({ name: 'Ada' });
    expect(mockRes.status).toBe(201);

    const logs = await waitForLogEntries(app, projectRes.body.id);

    expect(logs[0]).toMatchObject({
      path: '/users',
      requestBody: null,
      responseBody: {},
      origin: 'mock',
    });
  });

  it('borra los logs del proyecto via DELETE /projects/:projectId/logs', async () => {
    const projectRes = await apiPost(app, '/api/v1/projects').send({ name: 'Delete Logs' });
    expect(projectRes.status).toBe(201);

    const endpointRes = await apiPost(app, `/api/v1/projects/${projectRes.body.id}/endpoints`).send(
      { method: 'GET', path: '/users', statusCode: 200, responseBody: { ok: true } }
    );
    expect(endpointRes.status).toBe(201);

    const mockRes = await request(app).get(`/mock/${projectRes.body.slug}/users`);
    expect(mockRes.status).toBe(200);

    const logsBeforeDelete = await waitForLogEntries(app, projectRes.body.id);
    expect(logsBeforeDelete.length).toBeGreaterThan(0);

    const deleteRes = await apiDelete(app, `/api/v1/projects/${projectRes.body.id}/logs`);
    expect(deleteRes.status).toBe(204);

    const listAfterDelete = await apiGet(app, `/api/v1/projects/${projectRes.body.id}/logs`);
    expect(listAfterDelete.status).toBe(200);
    expect(listAfterDelete.body.items).toEqual([]);

    const countAfterDelete = await prisma.apiLog.count({
      where: { projectId: projectRes.body.id },
    });
    expect(countAfterDelete).toBe(0);
  });

  it('timeout scenario cierra socket (teardown)', async () => {
    const projectRes = await apiPost(app, '/api/v1/projects').send({ name: 'Timeout Mock' });
    expect(projectRes.status).toBe(201);

    const endpointRes = await apiPost(app, `/api/v1/projects/${projectRes.body.id}/endpoints`).send(
      { method: 'GET', path: '/slow', statusCode: 200, responseBody: { ok: true } }
    );
    expect(endpointRes.status).toBe(201);

    const scenarioRes = await apiPost(
      app,
      `/api/v1/endpoints/${endpointRes.body.id}/scenarios`
    ).send({
      name: 'timeout-case',
      type: 'timeout',
      statusCode: 504,
      body: { timeout: true },
      delayMs: 0,
      weight: 1,
    });

    expect(scenarioRes.status).toBe(201);

    const startedAt = Date.now();
    const timeoutRequest = request(app)
      .get(`/mock/${projectRes.body.slug}/slow`)
      .timeout({ response: 35000, deadline: 40000 });

    await expect(timeoutRequest).rejects.toThrow();
    const elapsedMs = Date.now() - startedAt;

    expect(elapsedMs).toBeGreaterThanOrEqual(29_000);
    expect(elapsedMs).toBeLessThan(40_000);
  }, 45000);
});
