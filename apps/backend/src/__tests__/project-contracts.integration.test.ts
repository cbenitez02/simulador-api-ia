import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
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
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  globalConfig: {
    upsert: vi.fn(),
  },
  endpoint: {
    delete: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  endpointConfig: {
    create: vi.fn(),
    upsert: vi.fn(),
  },
  scenario: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  auditEvent: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('openai', () => ({ default: class MockOpenAI {} }));

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

function buildActorIdentity(role: 'owner' | 'editor' | 'viewer' = 'owner') {
  return {
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
      memberships: [{ workspaceId: 'workspace-1', role }],
      personalWorkspace: { id: 'workspace-1' },
    },
  };
}

function buildProjectState() {
  return {
    id: 'project-1',
    workspaceId: 'workspace-1',
    slug: 'users-api',
    name: 'Users API',
    description: 'Demo',
    globalConfig: null,
    endpoints: [
      {
        id: 'endpoint-1',
        method: 'GET',
        path: '/users',
        description: 'List users',
        statusCode: 200,
        responseBody: [{ id: 1 }],
        endpointConfig: {
          latencyMode: 'fixed',
          fixedDelayMs: 0,
          minDelayMs: 0,
          maxDelayMs: 500,
          errorRate: 0,
          useScenarioWeights: true,
        },
        scenarios: [],
      },
    ],
  };
}

describe('project contracts integration', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://user:password@localhost:5432/simulador_api_ia_test';
    process.env.OPENAI_MODEL ??= 'gpt-4.1-mini';
    ({ app } = await import('../app.js'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.externalIdentity.findUnique.mockResolvedValue(buildActorIdentity());
    prismaMock.project.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        workspaceId: 'workspace-1',
      })
    );
    prismaMock.project.findUniqueOrThrow.mockResolvedValue(buildProjectState());
    prismaMock.user.findUnique.mockResolvedValue({
      email: 'owner@example.com',
      displayName: 'Owner User',
    });
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock)
    );
    prismaMock.endpoint.create.mockResolvedValue({ id: 'endpoint-2' });
  });

  it('exports a single-document contract and records a contract audit event', async () => {
    const response = await request(app)
      .get('/api/v1/projects/project-1/openapi?format=json')
      .set(authHeaders());

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('users-api-openapi.json');
    expect(JSON.parse(response.text)).toMatchObject({
      openapi: '3.0.3',
      info: { title: 'Users API' },
    });
    const warningHeader = response.headers['x-simulador-contract-warnings'];
    expect(typeof warningHeader).toBe('string');
    expect(JSON.parse(decodeURIComponent(warningHeader ?? '[]'))).toEqual([
      expect.objectContaining({
        code: 'default-global-config',
        path: 'x-simulador-api-ia.globalConfig',
      }),
      expect.objectContaining({ code: 'derived-scenarios', path: 'GET /users' }),
    ]);
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resourceType: 'contract',
          action: 'exported',
          metadata: expect.objectContaining({ warningCount: 2 }),
        }),
      })
    );
  });

  it('allows analyze for readers, avoids mutation side effects, and audits successful analysis', async () => {
    prismaMock.externalIdentity.findUnique.mockResolvedValue(buildActorIdentity('viewer'));

    const response = await request(app)
      .post('/api/v1/projects/project-1/openapi/analyze')
      .set(authHeaders())
      .attach(
        'file',
        Buffer.from(
          JSON.stringify({
            openapi: '3.0.3',
            info: { title: 'Users API', version: '1.0.0' },
            paths: {
              '/users': {
                get: {
                  responses: {
                    '200': { description: 'ok', content: { 'application/json': { example: [] } } },
                  },
                },
              },
            },
          })
        ),
        'contract.json'
      );

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({ create: 0, update: 1, delete: 0 });
    expect(prismaMock.endpoint.create).not.toHaveBeenCalled();
    expect(prismaMock.endpoint.update).not.toHaveBeenCalled();
    expect(prismaMock.endpoint.delete).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resourceType: 'contract',
          action: 'analyzed',
          metadata: expect.objectContaining({ create: 0, updated: 1, deleted: 0, warningCount: 0 }),
        }),
      })
    );
  });

  it('rejects import for viewers and editors, then writes an import audit event for owners', async () => {
    prismaMock.externalIdentity.findUnique.mockResolvedValue(buildActorIdentity('viewer'));

    const denied = await request(app)
      .post('/api/v1/projects/project-1/openapi/import')
      .set(authHeaders())
      .attach(
        'file',
        Buffer.from(
          JSON.stringify({
            openapi: '3.0.3',
            info: { title: 'Users API', version: '1.0.0' },
            paths: {
              '/accounts': {
                post: {
                  responses: {
                    '201': {
                      description: 'created',
                      content: { 'application/json': { example: { ok: true } } },
                    },
                  },
                },
              },
            },
          })
        ),
        'contract.json'
      );

    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({
      error: 'You do not have permission to import OpenAPI contracts',
      code: 'WORKSPACE_CONTRACT_IMPORT_DENIED',
    });

    prismaMock.externalIdentity.findUnique.mockResolvedValue(buildActorIdentity('editor'));
    const editorDenied = await request(app)
      .post('/api/v1/projects/project-1/openapi/import')
      .set(authHeaders())
      .attach(
        'file',
        Buffer.from(
          JSON.stringify({
            openapi: '3.0.3',
            info: { title: 'Users API', version: '1.0.0' },
            paths: {
              '/accounts': {
                post: {
                  responses: {
                    '201': {
                      description: 'created',
                      content: { 'application/json': { example: { ok: true } } },
                    },
                  },
                },
              },
            },
          })
        ),
        'contract.json'
      );

    expect(editorDenied.status).toBe(403);
    expect(editorDenied.body).toEqual({
      error: 'You do not have permission to import OpenAPI contracts',
      code: 'WORKSPACE_CONTRACT_IMPORT_DENIED',
    });

    prismaMock.externalIdentity.findUnique.mockResolvedValue(buildActorIdentity('owner'));
    const allowed = await request(app)
      .post('/api/v1/projects/project-1/openapi/import')
      .set(authHeaders())
      .attach(
        'file',
        Buffer.from(
          JSON.stringify({
            openapi: '3.0.3',
            info: { title: 'Users API', version: '1.0.0' },
            paths: {
              '/accounts': {
                post: {
                  responses: {
                    '201': {
                      description: 'created',
                      content: { 'application/json': { example: { ok: true } } },
                    },
                  },
                },
              },
            },
          })
        ),
        'contract.json'
      );

    expect(allowed.status).toBe(200);
    expect(allowed.body.committed).toMatchObject({ created: 1, deleted: 1 });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resourceType: 'contract', action: 'imported' }),
      })
    );
  });
});
