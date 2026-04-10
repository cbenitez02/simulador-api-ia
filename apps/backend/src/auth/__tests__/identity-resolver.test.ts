import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    externalIdentity: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { resolveActorIdentity } from '../identity-resolver.js';

describe('resolveActorIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provisions local user, personal workspace, and membership for a new external identity', async () => {
    prismaMock.externalIdentity.findUnique.mockResolvedValueOnce(null);

    const tx = {
      user: {
        create: vi.fn().mockResolvedValue({ id: 'user-1' }),
      },
      workspace: {
        create: vi.fn().mockResolvedValue({ id: 'workspace-1' }),
      },
      workspaceMembership: {
        create: vi.fn().mockResolvedValue({ id: 'membership-1' }),
      },
      externalIdentity: {
        create: vi.fn().mockResolvedValue({
          provider: 'clerk',
          subject: 'user_clerk_123',
          email: 'owner@example.com',
          emailVerified: true,
          displayName: 'Owner User',
          user: {
            id: 'user-1',
            memberships: [{ workspaceId: 'workspace-1', role: 'owner' }],
            personalWorkspace: { id: 'workspace-1' },
          },
        }),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(async (callback) => callback(tx));

    const actor = await resolveActorIdentity({
      provider: 'clerk',
      subject: 'user_clerk_123',
      email: 'owner@example.com',
      emailVerified: true,
      displayName: 'Owner User',
    });

    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        email: 'owner@example.com',
        displayName: 'Owner User',
      },
    });
    expect(tx.workspace.create).toHaveBeenCalledWith({
      data: {
        name: 'Owner User Personal Workspace',
        kind: 'personal',
        personalForUserId: 'user-1',
      },
    });
    expect(tx.workspaceMembership.create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'owner',
      },
    });
    expect(actor).toEqual({
      userId: 'user-1',
      personalWorkspaceId: 'workspace-1',
      identity: { provider: 'clerk', subject: 'user_clerk_123' },
      workspaceMemberships: [{ workspaceId: 'workspace-1', role: 'owner' }],
    });
  });

  it('reuses the existing local actor and refreshes profile fields when the identity already exists', async () => {
    const userUpdate = vi.fn().mockResolvedValue(undefined);
    const externalIdentityUpdate = vi.fn().mockResolvedValue(undefined);

    prismaMock.externalIdentity.findUnique.mockResolvedValueOnce({
      provider: 'clerk',
      subject: 'user_clerk_123',
      email: 'old@example.com',
      emailVerified: false,
      displayName: 'Old Name',
      userId: 'user-1',
      user: {
        id: 'user-1',
        email: 'old@example.com',
        displayName: 'Old Name',
        memberships: [{ workspaceId: 'workspace-1', role: 'owner' }],
        personalWorkspace: { id: 'workspace-1' },
      },
    });

    const tx = {
      user: {
        update: userUpdate,
      },
      externalIdentity: {
        update: externalIdentityUpdate,
      },
    };

    prismaMock.$transaction.mockImplementationOnce(async (callback) => callback(tx));

    const actor = await resolveActorIdentity({
      provider: 'clerk',
      subject: 'user_clerk_123',
      email: 'owner@example.com',
      emailVerified: true,
      displayName: 'Owner User',
    });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        email: 'owner@example.com',
        displayName: 'Owner User',
      },
    });
    expect(externalIdentityUpdate).toHaveBeenCalledWith({
      where: {
        provider_subject: {
          provider: 'clerk',
          subject: 'user_clerk_123',
        },
      },
      data: {
        email: 'owner@example.com',
        emailVerified: true,
        displayName: 'Owner User',
      },
    });
    expect(actor.workspaceMemberships).toEqual([{ workspaceId: 'workspace-1', role: 'owner' }]);
  });
});
