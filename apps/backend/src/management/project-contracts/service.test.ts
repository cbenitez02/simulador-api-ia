import { beforeAll, describe, expect, it, vi } from 'vitest';
import type * as ProjectContractsService from './service.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    project: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    endpoint: { findUnique: vi.fn() },
    auditEvent: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

let buildProjectContractDocument: typeof ProjectContractsService.buildProjectContractDocument;
let buildProjectContractKey: typeof ProjectContractsService.buildProjectContractKey;
let parseProjectContractDocument: typeof ProjectContractsService.parseProjectContractDocument;

beforeAll(async () => {
  ({ buildProjectContractDocument, buildProjectContractKey, parseProjectContractDocument } =
    await import('./service.js'));
});

describe('project-contracts/service helpers', () => {
  it('exports canonical operations with simulator extensions preserved', () => {
    const exported = buildProjectContractDocument({
      id: 'project-1',
      name: 'Users API',
      slug: 'users-api',
      description: 'Demo',
      workspaceId: 'workspace-1',
      globalConfig: null,
      endpoints: [
        {
          id: 'endpoint-1',
          method: 'get',
          path: '/users',
          description: 'List users',
          statusCode: 200,
          responseBody: [{ id: 1 }],
          endpointConfig: {
            latencyMode: 'range',
            fixedDelayMs: 0,
            minDelayMs: 10,
            maxDelayMs: 40,
            errorRate: 0,
            useScenarioWeights: true,
          },
          scenarios: [
            {
              name: 'ok',
              type: 'success',
              statusCode: 200,
              body: [{ id: 1 }],
              delayMs: 0,
              weight: 1,
            },
          ],
        },
      ],
    });

    expect(exported.document.paths['/users']?.get).toMatchObject({
      description: 'List users',
      responses: {
        '200': {
          content: { 'application/json': { example: [{ id: 1 }] } },
        },
      },
      'x-simulador-api-ia': {
        endpointConfig: {
          latencyMode: 'range',
          minDelayMs: 10,
          maxDelayMs: 40,
        },
        scenarios: [{ name: 'ok', type: 'success' }],
      },
    });
    expect(
      (exported.document as unknown as Record<string, unknown>)['x-simulador-api-ia']
    ).toMatchObject({
      globalConfig: { projectId: 'project-1' },
    });
    expect(exported.warnings.map((warning) => warning.code)).toEqual(['default-global-config']);
  });

  it('warns when export needs to synthesize endpoint defaults that are not persisted', () => {
    const exported = buildProjectContractDocument({
      id: 'project-1',
      name: 'Users API',
      slug: 'users-api',
      description: 'Demo',
      workspaceId: 'workspace-1',
      globalConfig: {
        projectId: 'project-1',
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
      },
      endpoints: [
        {
          id: 'endpoint-1',
          method: 'get',
          path: '/users',
          description: 'List users',
          statusCode: 200,
          responseBody: [{ id: 1 }],
          endpointConfig: null,
          scenarios: [
            {
              name: 'ok',
              type: 'success',
              statusCode: 200,
              body: [{ id: 1 }],
              delayMs: 0,
              weight: 1,
            },
          ],
        },
      ],
    });

    expect(exported.warnings.map((warning) => warning.code)).toEqual(['default-endpoint-config']);
  });

  it('parses importable documents, preserves extensions, and warns on missing examples', async () => {
    const parsed = await parseProjectContractDocument(
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Users API', version: '1.2.3' },
        paths: {
          '/users': {
            get: {
              description: 'List users',
              responses: {
                '200': {
                  description: 'ok',
                },
              },
              'x-simulador-api-ia': {
                endpointConfig: { latencyMode: 'fixed', fixedDelayMs: 25 },
                scenarios: [
                  {
                    name: 'ok',
                    type: 'success',
                    statusCode: 200,
                    body: [{ id: 1 }],
                    delayMs: 0,
                    weight: 1,
                  },
                ],
              },
            },
          },
        },
      }),
      'users.json'
    );

    expect(parsed.title).toBe('Users API');
    expect(parsed.version).toBe('1.2.3');
    expect(parsed.operations).toHaveLength(1);
    expect(parsed.operations[0]).toMatchObject({
      method: 'GET',
      path: '/users',
      endpointConfig: { latencyMode: 'fixed', fixedDelayMs: 25 },
      scenarios: [{ name: 'ok', type: 'success' }],
      responseBody: {},
    });
    expect(parsed.warnings.map((warning) => warning.code)).toContain('missing-example');
  });

  it('rejects external refs and keeps method-path keys canonical', async () => {
    await expect(
      parseProjectContractDocument(
        JSON.stringify({
          openapi: '3.0.3',
          info: { title: 'Invalid', version: '1.0.0' },
          paths: {
            '/users': {
              get: {
                responses: {
                  '200': {
                    description: 'ok',
                    content: {
                      'application/json': {
                        schema: { $ref: 'https://example.com/schemas/user.json#/User' },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(buildProjectContractKey(' get ', '/users')).toBe('GET /users');
  });

  it.each([
    {
      name: 'invalid json payloads',
      sourceText: '{"openapi":',
      sourceName: 'broken.json',
      expectedCode: 'OPENAPI_PARSE_FAILED',
    },
    {
      name: 'invalid yaml payloads',
      sourceText: 'openapi: [3.0.3',
      sourceName: 'broken.yaml',
      expectedCode: 'OPENAPI_PARSE_FAILED',
    },
    {
      name: 'non-openapi documents',
      sourceText: JSON.stringify({ hello: 'world' }),
      sourceName: 'not-openapi.json',
      expectedCode: 'OPENAPI_INVALID',
    },
  ])('rejects $name', async ({ sourceText, sourceName, expectedCode }) => {
    await expect(parseProjectContractDocument(sourceText, sourceName)).rejects.toMatchObject({
      statusCode: 400,
      options: expect.objectContaining({ code: expectedCode }),
    });
  });
});
