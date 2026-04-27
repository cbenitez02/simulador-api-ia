import { requireWorkspaceAccess } from '../../auth/authorization.js';
import type { AuthenticatedActor, WorkspaceRole } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import type { AddWorkspaceMemberInput, UpdateWorkspaceMemberRoleInput } from './schema.js';

function toWorkspaceMemberDto(member: {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  createdAt: Date;
  user: { email: string | null; displayName: string | null };
}) {
  return {
    userId: member.userId,
    email: member.user.email,
    displayName: member.user.displayName,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
  };
}

function normalizeWorkspaceRole(role: string): WorkspaceRole {
  return role === 'owner' || role === 'editor' ? role : 'viewer';
}

export async function listWorkspaceMembers(actor: AuthenticatedActor, workspaceId: string) {
  requireWorkspaceAccess(actor, workspaceId, 'read');

  const items = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
    select: {
      userId: true,
      role: true,
      createdAt: true,
      user: {
        select: {
          email: true,
          displayName: true,
        },
      },
    },
  });

  return {
    items: items.map((item) =>
      toWorkspaceMemberDto({
        ...item,
        role: item.role === 'owner' || item.role === 'editor' ? item.role : 'viewer',
      })
    ),
  };
}

export async function addWorkspaceMember(
  actor: AuthenticatedActor,
  workspaceId: string,
  input: AddWorkspaceMemberInput
) {
  requireWorkspaceAccess(actor, workspaceId, 'owner');

  const normalizedEmail = input.email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found for that email', {
      code: 'WORKSPACE_MEMBER_USER_NOT_FOUND',
    });
  }

  const existingMembership = await prisma.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: user.id,
      },
    },
    select: { userId: true },
  });

  if (existingMembership) {
    throw new AppError(409, 'User is already a workspace member', {
      code: 'WORKSPACE_MEMBER_ALREADY_EXISTS',
    });
  }

  const membership = await prisma.workspaceMembership.create({
    data: {
      workspaceId,
      userId: user.id,
      role: input.role,
    },
    select: {
      userId: true,
      role: true,
      createdAt: true,
      user: {
        select: {
          email: true,
          displayName: true,
        },
      },
    },
  });

  return toWorkspaceMemberDto({
    ...membership,
    role: normalizeWorkspaceRole(membership.role),
  });
}

export async function removeWorkspaceMember(
  actor: AuthenticatedActor,
  workspaceId: string,
  memberUserId: string
): Promise<void> {
  requireWorkspaceAccess(actor, workspaceId, 'owner');

  if (actor.personalWorkspaceId === workspaceId && actor.userId === memberUserId) {
    throw new AppError(409, 'Personal workspace owners must keep their own membership', {
      code: 'PERSONAL_WORKSPACE_OWNER_MEMBERSHIP_REQUIRED',
    });
  }

  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: memberUserId,
      },
    },
    select: { userId: true },
  });

  if (!membership) {
    throw new AppError(404, 'Workspace member not found', {
      code: 'WORKSPACE_MEMBER_NOT_FOUND',
    });
  }

  await prisma.workspaceMembership.delete({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: memberUserId,
      },
    },
  });
}

export async function updateWorkspaceMemberRole(
  actor: AuthenticatedActor,
  workspaceId: string,
  memberUserId: string,
  input: UpdateWorkspaceMemberRoleInput
) {
  requireWorkspaceAccess(actor, workspaceId, 'owner');

  if (actor.userId === memberUserId && input.role !== 'owner') {
    throw new AppError(409, 'Workspace owners cannot demote themselves in this flow', {
      code: 'WORKSPACE_MEMBER_SELF_DEMOTION_BLOCKED',
    });
  }

  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: memberUserId,
      },
    },
    select: {
      userId: true,
      role: true,
      createdAt: true,
      user: {
        select: {
          email: true,
          displayName: true,
        },
      },
    },
  });

  if (!membership) {
    throw new AppError(404, 'Workspace member not found', {
      code: 'WORKSPACE_MEMBER_NOT_FOUND',
    });
  }

  if (membership.role === 'owner' && input.role !== 'owner') {
    const ownerCount = await prisma.workspaceMembership.count({
      where: {
        workspaceId,
        role: 'owner',
      },
    });

    if (ownerCount <= 1) {
      throw new AppError(409, 'Workspaces must keep at least one owner', {
        code: 'WORKSPACE_LAST_OWNER_REQUIRED',
      });
    }
  }

  const updatedMembership = await prisma.workspaceMembership.update({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: memberUserId,
      },
    },
    data: {
      role: input.role,
    },
    select: {
      userId: true,
      role: true,
      createdAt: true,
      user: {
        select: {
          email: true,
          displayName: true,
        },
      },
    },
  });

  return toWorkspaceMemberDto({
    ...updatedMembership,
    role: normalizeWorkspaceRole(updatedMembership.role),
  });
}
