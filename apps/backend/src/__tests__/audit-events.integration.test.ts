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
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  globalConfig: {
    create: vi.fn(),
  },
  auditEvent: {
    create: vi.fn(),
    findMany: vi.fn(),
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

function buildActorIdentity() {
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
      memberships: [{ workspaceId: 'workspace-1', role: 'owner' }],
      personalWorkspace: { id: 'workspace-1' },
    },
  };
}

describe('audit events integration', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://user:password@localhost:5432/simulador_api_ia_test';
    process.env.OPENAI_MODEL ??= 'gpt-4.1-mini';

    ({ app } = await import('../app.js'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.externalIdentity.findUnique.mockResolvedValue(buildActorIdentity());
  });

  it('writes an audit event with actor snapshot when creating a project', async () => {
    prismaMock.project.findMany.mockResolvedValue([]);

    const tx = {
      project: {
        create: vi.fn(async () => ({
          id: 'project-1',
          workspaceId: 'workspace-1',
          name: 'Payments API',
          slug: 'payments-api',
          description: 'Handles payments',
        })),
        findUniqueOrThrow: vi.fn(async () => ({
          id: 'project-1',
          workspaceId: 'workspace-1',
          name: 'Payments API',
          slug: 'payments-api',
          description: 'Handles payments',
          globalConfig: { projectId: 'project-1' },
          _count: { endpoints: 0 },
        })),
      },
      globalConfig: {
        create: vi.fn(async () => ({ projectId: 'project-1' })),
      },
      user: {
        findUnique: vi.fn(async () => ({ email: 'owner@example.com', displayName: 'Owner User' })),
      },
      auditEvent: {
        create: vi.fn(async () => ({ id: 'audit-1' })),
      },
    };

    prismaMock.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
    );

    const response = await request(app).post('/api/v1/projects').set(authHeaders()).send({
      name: 'Payments API',
      description: 'Handles payments',
    });

    expect(response.status).toBe(201);
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: 'user-1',
          actorEmail: 'owner@example.com',
          actorDisplayName: 'Owner User',
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          resourceType: 'project',
          resourceId: 'project-1',
          action: 'created',
          summary: 'Created project Payments API',
        }),
      })
    );
  });

  it('lists project audit history with cursor and filters', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      id: 'project-1',
      workspaceId: 'workspace-1',
    });
    prismaMock.auditEvent.findMany.mockResolvedValue([
      {
        id: 'audit-2',
        actorUserId: 'user-1',
        actorEmail: 'owner@example.com',
        actorDisplayName: 'Owner User',
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        resourceType: 'endpoint',
        resourceId: 'endpoint-1',
        action: 'updated',
        summary: 'Updated endpoint GET /users',
        metadata: { endpointPath: '/users', method: 'GET' },
        createdAt: new Date('2026-04-14T12:00:00.000Z'),
      },
    ]);

    const response = await request(app)
      .get('/api/v1/projects/project-1/audit-events')
      .set(authHeaders())
      .query({
        limit: 25,
        direction: 'older',
        cursorCreatedAt: '2026-04-14T11:59:00.000Z',
        cursorId: 'audit-1',
        resourceType: 'endpoint',
        action: 'updated',
      });

    expect(response.status).toBe(200);
    expect(prismaMock.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'project-1',
          resourceType: 'endpoint',
          action: 'updated',
        }),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 25,
      })
    );
    expect(response.body).toEqual({
      items: [
        {
          id: 'audit-2',
          actor: {
            userId: 'user-1',
            email: 'owner@example.com',
            displayName: 'Owner User',
          },
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          resourceType: 'endpoint',
          resourceId: 'endpoint-1',
          action: 'updated',
          summary: 'Updated endpoint GET /users',
          metadata: { endpointPath: '/users', method: 'GET' },
          createdAt: '2026-04-14T12:00:00.000Z',
        },
      ],
      nextCursor: {
        createdAt: '2026-04-14T12:00:00.000Z',
        id: 'audit-2',
      },
      serverTime: expect.any(String),
    });
  });
});
