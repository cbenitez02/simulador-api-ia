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
  },
  projectSnapshot: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  globalConfig: {
    upsert: vi.fn(),
  },
  endpoint: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  endpointConfig: {
    upsert: vi.fn(),
  },
  scenario: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  auditEvent: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {},
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

function buildActorIdentityForWorkspace(
  workspaceMemberships: Array<{ workspaceId: string; role: 'owner' | 'editor' | 'viewer' }>,
  personalWorkspaceId = workspaceMemberships[0]?.workspaceId ?? null
) {
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
      memberships: workspaceMemberships,
      personalWorkspace: personalWorkspaceId ? { id: personalWorkspaceId } : null,
    },
  };
}

describe('project snapshots integration', () => {
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
    prismaMock.user.findUnique.mockResolvedValue({
      email: 'owner@example.com',
      displayName: 'Owner User',
    });
  });

  it('creates a project snapshot and emits exactly one explicit snapshot audit event', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({
      id: 'project-1',
      workspaceId: 'workspace-1',
      slug: 'users-api',
      name: 'Users API',
      description: 'Demo project',
      globalConfig: null,
      endpoints: [],
    });

    const tx = {
      projectSnapshot: {
        create: vi.fn(async () => ({
          id: 'snapshot-1',
          projectId: 'project-1',
          name: 'Before edits',
          description: 'Safe restore point',
          createdByUserId: 'user-1',
          createdByEmail: 'owner@example.com',
          createdByDisplayName: 'Owner User',
          payload: { project: { id: 'project-1' }, globalConfig: {}, endpoints: [] },
          createdAt: new Date('2026-04-17T10:00:00.000Z'),
        })),
      },
      project: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: 'project-1',
          workspaceId: 'workspace-1',
          slug: 'users-api',
          name: 'Users API',
          description: 'Demo project',
          globalConfig: null,
          endpoints: [],
        })),
      },
      user: prismaMock.user,
      auditEvent: {
        create: vi.fn(async () => ({ id: 'audit-1' })),
      },
    };

    prismaMock.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
    );

    const response = await request(app)
      .post('/api/v1/projects/project-1/snapshots')
      .set(authHeaders())
      .send({ name: 'Before edits', description: 'Safe restore point' });

    expect(response.status).toBe(201);
    expect(tx.projectSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdByUserId: 'user-1',
          createdByEmail: 'owner@example.com',
          createdByDisplayName: 'Owner User',
        }),
      })
    );
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resourceType: 'snapshot',
          resourceId: 'snapshot-1',
          action: 'created',
          summary: 'Created snapshot Before edits',
        }),
      })
    );
  });

  it('returns an empty snapshot history when the project has no saved snapshots', async () => {
    prismaMock.projectSnapshot.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/v1/projects/project-1/snapshots')
      .set(authHeaders());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
  });

  it('lists only the requested project snapshots newest-first', async () => {
    const snapshotRows = [
      {
        id: 'snapshot-older',
        projectId: 'project-1',
        name: 'Older snapshot',
        description: '',
        createdByUserId: 'user-1',
        createdByEmail: 'owner@example.com',
        createdByDisplayName: 'Owner User',
        createdAt: new Date('2026-04-17T09:00:00.000Z'),
      },
      {
        id: 'snapshot-foreign',
        projectId: 'project-2',
        name: 'Foreign snapshot',
        description: '',
        createdByUserId: 'user-2',
        createdByEmail: 'other@example.com',
        createdByDisplayName: 'Other User',
        createdAt: new Date('2026-04-17T11:00:00.000Z'),
      },
      {
        id: 'snapshot-newest',
        projectId: 'project-1',
        name: 'Newest snapshot',
        description: '',
        createdByUserId: 'user-1',
        createdByEmail: 'owner@example.com',
        createdByDisplayName: 'Owner User',
        createdAt: new Date('2026-04-17T10:00:00.000Z'),
      },
    ];

    prismaMock.projectSnapshot.findMany.mockImplementation(
      async ({
        where,
        orderBy,
      }: {
        where: { projectId: string };
        orderBy: Array<Record<string, 'asc' | 'desc'>>;
      }) =>
        snapshotRows
          .filter((snapshot) => snapshot.projectId === where.projectId)
          .sort((left, right) => {
            const createdAtDelta = right.createdAt.getTime() - left.createdAt.getTime();
            if (createdAtDelta !== 0) return createdAtDelta;
            return right.id.localeCompare(left.id);
          })
          .filter(() =>
            orderBy.some((entry) =>
              Object.entries(entry).some(
                ([key, value]) => (key === 'createdAt' || key === 'id') && value === 'desc'
              )
            )
          )
    );

    const response = await request(app)
      .get('/api/v1/projects/project-1/snapshots')
      .set(authHeaders());

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
      'snapshot-newest',
      'snapshot-older',
    ]);
    expect(
      response.body.items.every((item: { projectId: string }) => item.projectId === 'project-1')
    ).toBe(true);
    expect(prismaMock.projectSnapshot.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });

  it('returns snapshot detail for readers with immutable creator metadata', async () => {
    prismaMock.projectSnapshot.findFirst.mockResolvedValue({
      id: 'snapshot-1',
      projectId: 'project-1',
      name: 'Before edits',
      description: 'Safe restore point',
      createdByUserId: 'user-1',
      createdByEmail: 'owner@example.com',
      createdByDisplayName: 'Owner User',
      payload: {
        project: {
          id: 'project-1',
          slug: 'users-api',
          name: 'Users API',
          description: 'Demo project',
        },
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
        endpoints: [],
      },
      createdAt: new Date('2026-04-17T10:00:00.000Z'),
    });

    const response = await request(app)
      .get('/api/v1/projects/project-1/snapshots/snapshot-1')
      .set(authHeaders());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 'snapshot-1',
      projectId: 'project-1',
      name: 'Before edits',
      createdBy: {
        userId: 'user-1',
        email: 'owner@example.com',
        displayName: 'Owner User',
      },
      payload: {
        project: { id: 'project-1', slug: 'users-api', name: 'Users API' },
        endpoints: [],
      },
    });
  });

  it('rejects reading snapshot detail through a different project id', async () => {
    prismaMock.projectSnapshot.findFirst.mockImplementation(
      async ({ where }: { where: { id: string; projectId: string } }) =>
        where.projectId === 'project-2'
          ? null
          : {
              id: where.id,
              projectId: 'project-1',
              name: 'Before edits',
              description: 'Safe restore point',
              createdByUserId: 'user-1',
              createdByEmail: 'owner@example.com',
              createdByDisplayName: 'Owner User',
              payload: { project: { id: 'project-1' }, globalConfig: {}, endpoints: [] },
              createdAt: new Date('2026-04-17T10:00:00.000Z'),
            }
    );

    const response = await request(app)
      .get('/api/v1/projects/project-2/snapshots/snapshot-1')
      .set(authHeaders());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Snapshot not found' });
  });

  it('allows viewers to read snapshot history but blocks snapshot creation', async () => {
    prismaMock.externalIdentity.findUnique.mockResolvedValue(buildActorIdentity('viewer'));
    prismaMock.projectSnapshot.findMany.mockResolvedValue([
      {
        id: 'snapshot-1',
        projectId: 'project-1',
        name: 'Before edits',
        description: 'Safe restore point',
        createdByUserId: 'user-1',
        createdByEmail: 'owner@example.com',
        createdByDisplayName: 'Owner User',
        createdAt: new Date('2026-04-17T10:00:00.000Z'),
      },
    ]);

    const listResponse = await request(app)
      .get('/api/v1/projects/project-1/snapshots')
      .set(authHeaders());
    const createResponse = await request(app)
      .post('/api/v1/projects/project-1/snapshots')
      .set(authHeaders())
      .send({ name: 'Blocked snapshot' });
    const restoreResponse = await request(app)
      .post('/api/v1/projects/project-1/snapshots/snapshot-1/restore')
      .set(authHeaders())
      .send({});

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);
    expect(createResponse.status).toBe(403);
    expect(restoreResponse.status).toBe(403);
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
  });

  it('blocks snapshot mutations for non-members without writing audit events', async () => {
    prismaMock.externalIdentity.findUnique.mockResolvedValue(
      buildActorIdentityForWorkspace([{ workspaceId: 'workspace-2', role: 'editor' }])
    );

    const createResponse = await request(app)
      .post('/api/v1/projects/project-1/snapshots')
      .set(authHeaders())
      .send({ name: 'Blocked snapshot' });
    const restoreResponse = await request(app)
      .post('/api/v1/projects/project-1/snapshots/snapshot-1/restore')
      .set(authHeaders())
      .send({});

    expect(createResponse.status).toBe(403);
    expect(createResponse.body).toEqual({
      error: 'You do not have access to this workspace',
      code: 'WORKSPACE_ACCESS_DENIED',
    });
    expect(restoreResponse.status).toBe(403);
    expect(restoreResponse.body).toEqual({
      error: 'You do not have access to this workspace',
      code: 'WORKSPACE_ACCESS_DENIED',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
  });

  it('blocks snapshot list and detail reads for non-members', async () => {
    prismaMock.externalIdentity.findUnique.mockResolvedValue(
      buildActorIdentityForWorkspace([{ workspaceId: 'workspace-2', role: 'viewer' }])
    );

    const listResponse = await request(app)
      .get('/api/v1/projects/project-1/snapshots')
      .set(authHeaders());
    const detailResponse = await request(app)
      .get('/api/v1/projects/project-1/snapshots/snapshot-1')
      .set(authHeaders());

    expect(listResponse.status).toBe(403);
    expect(listResponse.body).toEqual({
      error: 'You do not have access to this workspace',
      code: 'WORKSPACE_ACCESS_DENIED',
    });
    expect(detailResponse.status).toBe(403);
    expect(detailResponse.body).toEqual({
      error: 'You do not have access to this workspace',
      code: 'WORKSPACE_ACCESS_DENIED',
    });
    expect(prismaMock.projectSnapshot.findMany).not.toHaveBeenCalled();
    expect(prismaMock.projectSnapshot.findFirst).not.toHaveBeenCalled();
  });

  it('restores a snapshot through one transaction and emits a single restore audit event', async () => {
    prismaMock.projectSnapshot.findFirst.mockResolvedValue({
      id: 'snapshot-1',
      projectId: 'project-1',
      name: 'Before imports',
      description: '',
      createdByUserId: 'user-1',
      createdByEmail: 'owner@example.com',
      createdByDisplayName: 'Owner User',
      payload: {
        project: { id: 'project-1', slug: 'users-api', name: 'Users API', description: 'Baseline' },
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
      },
      createdAt: new Date('2026-04-17T10:00:00.000Z'),
    });

    const tx = {
      project: {
        update: vi.fn(async () => ({ id: 'project-1', workspaceId: 'workspace-1' })),
      },
      globalConfig: {
        upsert: vi.fn(async () => ({ projectId: 'project-1' })),
      },
      endpoint: {
        findMany: vi.fn(async () => [{ id: 'endpoint-old', method: 'DELETE', path: '/users/:id' }]),
        create: vi.fn(async () => ({ id: 'endpoint-1' })),
        update: vi.fn(),
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
      endpointConfig: {
        upsert: vi.fn(async () => ({ endpointId: 'endpoint-1' })),
      },
      scenario: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        createMany: vi.fn(async () => ({ count: 1 })),
      },
      user: prismaMock.user,
      auditEvent: {
        create: vi.fn(async () => ({ id: 'audit-restore' })),
      },
    };

    prismaMock.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
    );

    const response = await request(app)
      .post('/api/v1/projects/project-1/snapshots/snapshot-1/restore')
      .set(authHeaders())
      .send({});

    expect(response.status).toBe(200);
    expect(tx.endpoint.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['endpoint-old'] } },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resourceType: 'snapshot',
          resourceId: 'snapshot-1',
          action: 'restored',
          summary: 'Restored snapshot Before imports',
        }),
      })
    );
  });

  it('returns 401 without writing an audit event when the request is unauthenticated', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/snapshots')
      .send({ name: 'Blocked snapshot' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
  });

  it('fails restore atomically and skips restore audit writes when reconciliation throws', async () => {
    prismaMock.projectSnapshot.findFirst.mockResolvedValue({
      id: 'snapshot-1',
      projectId: 'project-1',
      name: 'Before imports',
      description: '',
      createdByUserId: 'user-1',
      createdByEmail: 'owner@example.com',
      createdByDisplayName: 'Owner User',
      payload: {
        project: { id: 'project-1', slug: 'users-api', name: 'Users API', description: 'Baseline' },
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
      },
      createdAt: new Date('2026-04-17T10:00:00.000Z'),
    });

    const tx = {
      project: {
        update: vi.fn(async () => ({ id: 'project-1', workspaceId: 'workspace-1' })),
      },
      globalConfig: {
        upsert: vi.fn(async () => ({ projectId: 'project-1' })),
      },
      endpoint: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => {
          throw new Error('restore failed');
        }),
        update: vi.fn(),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      endpointConfig: {
        upsert: vi.fn(async () => ({ endpointId: 'endpoint-1' })),
      },
      scenario: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        createMany: vi.fn(async () => ({ count: 0 })),
      },
      user: prismaMock.user,
      auditEvent: {
        create: vi.fn(async () => ({ id: 'audit-restore' })),
      },
    };

    prismaMock.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
    );

    const response = await request(app)
      .post('/api/v1/projects/project-1/snapshots/snapshot-1/restore')
      .set(authHeaders())
      .send({});

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal Server Error' });
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it('keeps the live project state unchanged when a transactional restore write fails mid-flight', async () => {
    const liveState: {
      project: {
        id: string;
        workspaceId: string;
        slug: string;
        name: string;
        description: string;
      };
      globalConfig: {
        projectId: string;
        latencyEnabled: boolean;
        latencyMinMs: number;
        latencyMaxMs: number;
        latencyMode: string;
        errorSimulationEnabled: boolean;
        errorSimulationRate: number;
        errorSimulationCodes: number[];
        rateLimitingEnabled: boolean;
        rateLimitingRpm: number;
        loggingLevel: string;
        scope: string;
      };
      endpoints: Array<{
        id: string;
        projectId: string;
        method: string;
        path: string;
        description: string;
        statusCode: number;
        responseBody: unknown;
      }>;
      auditEvents: Array<{ id: string }>;
    } = {
      project: {
        id: 'project-1',
        workspaceId: 'workspace-1',
        slug: 'users-api',
        name: 'Live Users API',
        description: 'Live description',
      },
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
          id: 'endpoint-live',
          projectId: 'project-1',
          method: 'DELETE',
          path: '/users/:id',
          description: 'Delete user',
          statusCode: 204,
          responseBody: null,
        },
      ],
      auditEvents: [] as Array<{ id: string }>,
    };

    prismaMock.project.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id !== liveState.project.id) return null;
        return { id: liveState.project.id, workspaceId: liveState.project.workspaceId };
      }
    );
    prismaMock.projectSnapshot.findFirst.mockResolvedValue({
      id: 'snapshot-1',
      projectId: 'project-1',
      name: 'Before imports',
      description: '',
      createdByUserId: 'user-1',
      createdByEmail: 'owner@example.com',
      createdByDisplayName: 'Owner User',
      payload: {
        project: {
          id: 'project-1',
          slug: 'users-api',
          name: 'Snapshot Users API',
          description: 'Snapshot description',
        },
        globalConfig: {
          projectId: 'project-1',
          latencyEnabled: true,
          latencyMinMs: 10,
          latencyMaxMs: 20,
          latencyMode: 'range',
          errorSimulationEnabled: false,
          errorSimulationRate: 0,
          errorSimulationCodes: [500],
          rateLimitingEnabled: true,
          rateLimitingRpm: 90,
          loggingLevel: 'full',
          scope: 'all',
        },
        endpoints: [
          {
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
      },
      createdAt: new Date('2026-04-17T10:00:00.000Z'),
    });

    prismaMock.$transaction.mockImplementation(
      async (callback: (client: Record<string, unknown>) => Promise<unknown>) => {
        const workingState = structuredClone(liveState);
        const tx = {
          project: {
            update: vi.fn(async ({ data }: { data: { name: string; description: string } }) => {
              workingState.project.name = data.name;
              workingState.project.description = data.description;
              return { ...workingState.project };
            }),
          },
          globalConfig: {
            upsert: vi.fn(async ({ update }: { update: typeof workingState.globalConfig }) => {
              workingState.globalConfig = { ...update };
              return workingState.globalConfig;
            }),
          },
          endpoint: {
            findMany: vi.fn(async () =>
              workingState.endpoints.map(({ id, method, path }) => ({ id, method, path }))
            ),
            create: vi.fn(
              async ({
                data,
              }: {
                data: {
                  projectId: string;
                  method: string;
                  path: string;
                  description: string;
                  statusCode: number;
                  responseBody: unknown;
                };
              }) => {
                const created = { id: 'endpoint-created', ...data };
                workingState.endpoints.push(created);
                return { id: created.id };
              }
            ),
            update: vi.fn(),
            deleteMany: vi.fn(async () => ({ count: 0 })),
          },
          endpointConfig: {
            upsert: vi.fn(async () => {
              throw new Error('restore failed after writes');
            }),
          },
          scenario: {
            deleteMany: vi.fn(async () => ({ count: 0 })),
            createMany: vi.fn(async () => ({ count: 0 })),
          },
          auditEvent: {
            create: vi.fn(async ({ data }: { data: { id?: string } }) => {
              const event = { id: data.id ?? 'audit-restore' };
              workingState.auditEvents.push(event);
              return event;
            }),
          },
        };

        const result = await callback(tx);
        liveState.project = workingState.project;
        liveState.globalConfig = workingState.globalConfig;
        liveState.endpoints = workingState.endpoints;
        liveState.auditEvents = workingState.auditEvents;
        return result;
      }
    );

    const response = await request(app)
      .post('/api/v1/projects/project-1/snapshots/snapshot-1/restore')
      .set(authHeaders())
      .send({});

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal Server Error' });
    expect(liveState.project).toMatchObject({
      id: 'project-1',
      name: 'Live Users API',
      description: 'Live description',
    });
    expect(liveState.globalConfig).toMatchObject({
      projectId: 'project-1',
      latencyEnabled: false,
      rateLimitingEnabled: false,
      rateLimitingRpm: 60,
    });
    expect(liveState.endpoints).toEqual([
      {
        id: 'endpoint-live',
        projectId: 'project-1',
        method: 'DELETE',
        path: '/users/:id',
        description: 'Delete user',
        statusCode: 204,
        responseBody: null,
      },
    ]);
    expect(liveState.auditEvents).toEqual([]);
  });
});
