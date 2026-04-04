import request from 'supertest';
import type { Express } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { beforeAll, describe, expect, it, afterAll, beforeEach } from 'vitest';

const runDbTests = process.env.RUN_DB_TESTS === 'true';
const describeDb = runDbTests ? describe : describe.skip;

let app: Express;
let prisma: PrismaClient;

async function cleanDatabase() {
  await prisma.apiLog.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.endpointConfig.deleteMany();
  await prisma.endpoint.deleteMany();
  await prisma.globalConfig.deleteMany();
  await prisma.project.deleteMany();
}

describeDb('db integration (real postgres)', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL ??=
      'postgresql://postgres:postgres@localhost:54329/simulador_api_test?schema=public';
    process.env.OPENAI_API_KEY ??= 'test-key';
    process.env.OPENAI_MODEL ??= 'gpt-4.1-mini';

    ({ app } = await import('../app.js'));
    ({ prisma } = await import('../lib/prisma.js'));
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('crea proyecto y persiste globalConfig default', async () => {
    const response = await request(app).post('/api/v1/projects').send({
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

  it('flujo real de endpoint + scenario + mock + logs', async () => {
    const projectRes = await request(app).post('/api/v1/projects').send({ name: 'Demo Mock' });
    expect(projectRes.status).toBe(201);

    const endpointRes = await request(app)
      .post(`/api/v1/projects/${projectRes.body.id}/endpoints`)
      .send({
        method: 'GET',
        path: '/users',
        statusCode: 200,
        responseBody: { source: 'endpoint-default' },
      });

    expect(endpointRes.status).toBe(201);

    const scenarioRes = await request(app)
      .post(`/api/v1/endpoints/${endpointRes.body.id}/scenarios`)
      .send({
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

    const logsRes = await request(app).get(`/api/v1/projects/${projectRes.body.id}/logs`);
    expect(logsRes.status).toBe(200);
    expect(Array.isArray(logsRes.body)).toBe(true);
    expect(logsRes.body.length).toBeGreaterThan(0);
  });

  it('forced-error global responde código configurado', async () => {
    const projectRes = await request(app).post('/api/v1/projects').send({ name: 'Forced Error' });
    expect(projectRes.status).toBe(201);

    const endpointRes = await request(app)
      .post(`/api/v1/projects/${projectRes.body.id}/endpoints`)
      .send({ method: 'GET', path: '/healthz', statusCode: 200, responseBody: { ok: true } });
    expect(endpointRes.status).toBe(201);

    const cfgRes = await request(app)
      .put(`/api/v1/projects/${projectRes.body.id}/config`)
      .send({
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

  it('timeout scenario cierra socket (teardown)', async () => {
    const projectRes = await request(app).post('/api/v1/projects').send({ name: 'Timeout Mock' });
    expect(projectRes.status).toBe(201);

    const endpointRes = await request(app)
      .post(`/api/v1/projects/${projectRes.body.id}/endpoints`)
      .send({ method: 'GET', path: '/slow', statusCode: 200, responseBody: { ok: true } });
    expect(endpointRes.status).toBe(201);

    const scenarioRes = await request(app)
      .post(`/api/v1/endpoints/${endpointRes.body.id}/scenarios`)
      .send({
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
