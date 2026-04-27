import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authorizeEndpointAccessMock, writeAuditEventMock, prismaMock } = vi.hoisted(() => ({
  authorizeEndpointAccessMock: vi.fn(),
  writeAuditEventMock: vi.fn(),
  prismaMock: {
    endpointConfig: {
      findUnique: vi.fn(),
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
import { upsertEndpointConfig } from './service.js';

const actor: AuthenticatedActor = {
  userId: 'user-1',
  email: 'owner@example.com',
  displayName: 'Owner User',
  personalWorkspaceId: 'workspace-1',
  identity: {
    provider: 'clerk',
    subject: 'user_clerk_123',
  },
  workspaceMemberships: [{ workspaceId: 'workspace-1', role: 'owner' }],
};

describe('endpoint-config/service upsertEndpointConfig', () => {
  beforeEach(() => {
    authorizeEndpointAccessMock.mockReset();
    authorizeEndpointAccessMock.mockResolvedValue(undefined);
    writeAuditEventMock.mockReset();
    prismaMock.endpointConfig.findUnique.mockReset();
    prismaMock.$transaction.mockReset();
  });

  it('skips updated audit events for no-op config upserts after canonicalization', async () => {
    prismaMock.endpointConfig.findUnique.mockResolvedValue({
      endpointId: 'e1',
      latencyMode: 'fixed',
      fixedDelayMs: 25,
      minDelayMs: 0,
      maxDelayMs: 500,
      errorRate: 0,
      useScenarioWeights: true,
    });

    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        endpointConfig: {
          upsert: vi.fn(async () => ({
            id: 'cfg-1',
            endpointId: 'e1',
            latencyMode: 'fixed',
            fixedDelayMs: 25,
            minDelayMs: 0,
            maxDelayMs: 500,
            errorRate: 0,
            useScenarioWeights: true,
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

    await upsertEndpointConfig(actor, 'e1', {
      latencyMode: 'fixed',
      fixedDelayMs: 25,
      minDelayMs: 0,
      maxDelayMs: 500,
      errorRate: 0.4,
      useScenarioWeights: true,
    });

    expect(writeAuditEventMock).not.toHaveBeenCalled();
  });

  it('still emits updated audit events when a config field really changes', async () => {
    prismaMock.endpointConfig.findUnique.mockResolvedValue({
      endpointId: 'e1',
      latencyMode: 'fixed',
      fixedDelayMs: 25,
      minDelayMs: 0,
      maxDelayMs: 500,
      errorRate: 0,
      useScenarioWeights: true,
    });

    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        endpointConfig: {
          upsert: vi.fn(async () => ({
            id: 'cfg-1',
            endpointId: 'e1',
            latencyMode: 'range',
            fixedDelayMs: 25,
            minDelayMs: 10,
            maxDelayMs: 40,
            errorRate: 0,
            useScenarioWeights: true,
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

    await upsertEndpointConfig(actor, 'e1', {
      latencyMode: 'range',
      fixedDelayMs: 25,
      minDelayMs: 10,
      maxDelayMs: 40,
      errorRate: 0,
      useScenarioWeights: true,
    });

    expect(writeAuditEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        resourceType: 'endpoint-config',
        resourceId: 'cfg-1',
        action: 'updated',
        summary: 'Updated endpoint config for GET /users',
      })
    );
  });
});
