import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authorizeEndpointAccessMock, writeAuditEventMock, prismaMock } = vi.hoisted(() => ({
  authorizeEndpointAccessMock: vi.fn(),
  writeAuditEventMock: vi.fn(),
  prismaMock: {
    scenario: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../auth/authorization.js', () => ({
  authorizeEndpointAccess: authorizeEndpointAccessMock,
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../audit-events/service.js', () => ({
  writeAuditEvent: writeAuditEventMock,
}));

import type { AuthenticatedActor } from '../../auth/types.js';
import { updateScenario } from './service.js';

const actor: AuthenticatedActor = {
  userId: 'user-1',
  personalWorkspaceId: 'workspace-1',
  identity: {
    provider: 'clerk',
    subject: 'user_clerk_123',
  },
  workspaceMemberships: [{ workspaceId: 'workspace-1', role: 'owner' }],
};

describe('scenarios/service updateScenario', () => {
  beforeEach(() => {
    authorizeEndpointAccessMock.mockReset();
    authorizeEndpointAccessMock.mockResolvedValue(undefined);
    writeAuditEventMock.mockReset();
    prismaMock.scenario.findFirst.mockReset();
    prismaMock.$transaction.mockReset();
  });

  it('skips updated audit events for no-op scenario patches', async () => {
    prismaMock.scenario.findFirst.mockResolvedValue({
      id: 's1',
      name: 'Success',
      type: 'success',
      statusCode: 200,
      body: { ok: true },
      delayMs: 50,
      weight: 10,
    });

    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        scenario: {
          update: vi.fn(async () => ({
            id: 's1',
            name: 'Success',
            type: 'success',
            statusCode: 200,
            body: { ok: true },
            delayMs: 50,
            weight: 10,
          })),
        },
        endpoint: {
          findUniqueOrThrow: vi.fn(async () => ({
            method: 'GET',
            path: '/users',
            projectId: 'p1',
            project: { workspaceId: 'workspace-1' },
          })),
        },
      })
    );

    await updateScenario(actor, 'e1', 's1', {
      name: 'Success',
      type: 'success',
      statusCode: 200,
      body: { ok: true },
      delayMs: 50,
      weight: 10,
    });

    expect(writeAuditEventMock).not.toHaveBeenCalled();
  });

  it('still emits updated audit events when a scenario field really changes', async () => {
    prismaMock.scenario.findFirst.mockResolvedValue({
      id: 's1',
      name: 'Success',
      type: 'success',
      statusCode: 200,
      body: { ok: true },
      delayMs: 50,
      weight: 10,
    });

    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        scenario: {
          update: vi.fn(async () => ({
            id: 's1',
            name: 'Success renamed',
            type: 'success',
            statusCode: 200,
            body: { ok: true },
            delayMs: 50,
            weight: 10,
          })),
        },
        endpoint: {
          findUniqueOrThrow: vi.fn(async () => ({
            method: 'GET',
            path: '/users',
            projectId: 'p1',
            project: { workspaceId: 'workspace-1' },
          })),
        },
      })
    );

    await updateScenario(actor, 'e1', 's1', {
      name: 'Success renamed',
    });

    expect(writeAuditEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        resourceType: 'scenario',
        resourceId: 's1',
        action: 'updated',
        summary: 'Updated scenario Success renamed',
      })
    );
  });
});
