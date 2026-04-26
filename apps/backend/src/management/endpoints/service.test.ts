import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authorizeProjectAccessMock, writeAuditEventMock, prismaMock } = vi.hoisted(() => ({
  authorizeProjectAccessMock: vi.fn(),
  writeAuditEventMock: vi.fn(),
  prismaMock: {
    endpoint: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../auth/authorization.js', () => ({
  authorizeProjectAccess: authorizeProjectAccessMock,
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../audit-events/service.js', () => ({
  writeAuditEvent: writeAuditEventMock,
}));

import type { AuthenticatedActor } from '../../auth/types.js';
import { updateEndpoint } from './service.js';

const actor: AuthenticatedActor = {
  userId: 'user-1',
  personalWorkspaceId: 'workspace-1',
  identity: {
    provider: 'clerk',
    subject: 'user_clerk_123',
  },
  workspaceMemberships: [{ workspaceId: 'workspace-1', role: 'owner' }],
};

describe('endpoints/service updateEndpoint', () => {
  beforeEach(() => {
    authorizeProjectAccessMock.mockReset();
    authorizeProjectAccessMock.mockResolvedValue(undefined);
    writeAuditEventMock.mockReset();
    prismaMock.endpoint.findFirst.mockReset();
    prismaMock.$transaction.mockReset();
  });

  it('skips updated audit events for no-op endpoint patches', async () => {
    prismaMock.endpoint.findFirst.mockResolvedValue({
      id: 'e1',
      description: 'List users',
      statusCode: 200,
      responseBody: { ok: true },
    });

    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        endpoint: {
          update: vi.fn(async () => ({
            id: 'e1',
            method: 'GET',
            path: '/users',
            description: 'List users',
            statusCode: 200,
            responseBody: { ok: true },
            endpointConfig: null,
            scenarios: [],
            project: { workspaceId: 'workspace-1' },
          })),
        },
      })
    );

    await updateEndpoint(actor, 'p1', 'e1', {
      description: 'List users',
      statusCode: 200,
      responseBody: { ok: true },
    });

    expect(writeAuditEventMock).not.toHaveBeenCalled();
  });

  it('still emits updated audit events when an endpoint field really changes', async () => {
    prismaMock.endpoint.findFirst.mockResolvedValue({
      id: 'e1',
      description: 'List users',
      statusCode: 200,
      responseBody: { ok: true },
    });

    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        endpoint: {
          update: vi.fn(async () => ({
            id: 'e1',
            method: 'GET',
            path: '/users',
            description: 'List active users',
            statusCode: 200,
            responseBody: { ok: true },
            endpointConfig: null,
            scenarios: [],
            project: { workspaceId: 'workspace-1' },
          })),
        },
      })
    );

    await updateEndpoint(actor, 'p1', 'e1', {
      description: 'List active users',
    });

    expect(writeAuditEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        resourceType: 'endpoint',
        resourceId: 'e1',
        action: 'updated',
        summary: 'Updated endpoint GET /users',
      })
    );
  });
});
