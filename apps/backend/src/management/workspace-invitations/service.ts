import { Prisma } from '@prisma/client';
import { requireWorkspaceAccess } from '../../auth/authorization.js';
import type { AuthenticatedActor, WorkspaceRole } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import type { CreateWorkspaceInvitationInput } from './schema.js';

function normalizeWorkspaceRole(role: string): WorkspaceRole {
  return role === 'owner' || role === 'editor' ? role : 'viewer';
}

function requireInvitableRole(role: string): 'viewer' | 'editor' {
  if (role === 'viewer' || role === 'editor') {
    return role;
  }

  throw new AppError(400, 'Invitation role must be viewer or editor', {
    code: 'WORKSPACE_INVITATION_ROLE_NOT_INVITABLE',
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireActorEmail(actor: AuthenticatedActor): string {
  const email = normalizeEmail(actor.email ?? '');

  if (!email) {
    throw new AppError(400, 'Authenticated users must have an email for invitation flows', {
      code: 'AUTHENTICATED_EMAIL_REQUIRED',
    });
  }

  return email;
}

function toWorkspaceInvitationDto(invitation: {
  id: string;
  workspaceId: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: Date;
  workspace: { id: string; name: string };
}) {
  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    workspaceName: invitation.workspace.name,
    email: invitation.email,
    role: normalizeWorkspaceRole(invitation.role),
    status: invitation.status,
    createdAt: invitation.createdAt.toISOString(),
  };
}

function mapPendingInvitationConflict(status: string): never {
  if (status === 'accepted') {
    throw new AppError(409, 'Invitation was already accepted', {
      code: 'WORKSPACE_INVITATION_ALREADY_ACCEPTED',
    });
  }

  if (status === 'revoked') {
    throw new AppError(409, 'Invitation was already revoked', {
      code: 'WORKSPACE_INVITATION_ALREADY_REVOKED',
    });
  }

  throw new AppError(409, 'Invitation is no longer pending', {
    code: 'WORKSPACE_INVITATION_NOT_PENDING',
  });
}

export async function listWorkspaceInvitations(actor: AuthenticatedActor, workspaceId: string) {
  requireWorkspaceAccess(actor, workspaceId, 'owner');

  const items = await prisma.workspaceInvitation.findMany({
    where: { workspaceId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      workspaceId: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    items: items.map((item) =>
      toWorkspaceInvitationDto({
        ...item,
        status: item.status === 'accepted' || item.status === 'revoked' ? item.status : 'pending',
      })
    ),
  };
}

export async function createWorkspaceInvitation(
  actor: AuthenticatedActor,
  workspaceId: string,
  input: CreateWorkspaceInvitationInput
) {
  requireWorkspaceAccess(actor, workspaceId, 'owner');

  const invitationRole = requireInvitableRole(input.role);
  const normalizedEmail = normalizeEmail(input.email);
  const existingMembership = await prisma.workspaceMembership.findFirst({
    where: {
      workspaceId,
      user: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
    },
    select: { userId: true },
  });

  if (existingMembership) {
    throw new AppError(409, 'User is already a workspace member', {
      code: 'WORKSPACE_MEMBER_ALREADY_EXISTS',
    });
  }

  const existingPendingInvitation = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId,
      email: normalizedEmail,
      status: 'pending',
    },
    select: { id: true },
  });

  if (existingPendingInvitation) {
    throw new AppError(409, 'A pending invitation already exists for that email', {
      code: 'WORKSPACE_INVITATION_ALREADY_PENDING',
    });
  }

  try {
    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: normalizedEmail,
        role: invitationRole,
        status: 'pending',
        invitedByUserId: actor.userId,
      },
      select: {
        id: true,
        workspaceId: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return toWorkspaceInvitationDto({
      ...invitation,
      status: 'pending',
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'A pending invitation already exists for that email', {
        code: 'WORKSPACE_INVITATION_ALREADY_PENDING',
      });
    }

    throw error;
  }
}

export async function revokeWorkspaceInvitation(
  actor: AuthenticatedActor,
  workspaceId: string,
  invitationId: string
) {
  requireWorkspaceAccess(actor, workspaceId, 'owner');

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      workspaceId: true,
      status: true,
    },
  });

  if (!invitation || invitation.workspaceId !== workspaceId) {
    throw new AppError(404, 'Workspace invitation not found', {
      code: 'WORKSPACE_INVITATION_NOT_FOUND',
    });
  }

  if (invitation.status !== 'pending') {
    mapPendingInvitationConflict(invitation.status);
  }

  await prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: {
      status: 'revoked',
      revokedAt: new Date(),
    },
  });
}

export async function listPendingWorkspaceInvitations(actor: AuthenticatedActor) {
  const actorEmail = requireActorEmail(actor);
  const items = await prisma.workspaceInvitation.findMany({
    where: {
      email: actorEmail,
      status: 'pending',
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      workspaceId: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    items: items.map((item) =>
      toWorkspaceInvitationDto({
        ...item,
        status: 'pending',
      })
    ),
  };
}

export async function acceptWorkspaceInvitation(actor: AuthenticatedActor, invitationId: string) {
  const actorEmail = requireActorEmail(actor);
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      workspaceId: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (!invitation) {
    throw new AppError(404, 'Workspace invitation not found', {
      code: 'WORKSPACE_INVITATION_NOT_FOUND',
    });
  }

  if (invitation.status !== 'pending') {
    mapPendingInvitationConflict(invitation.status);
  }

  if (normalizeEmail(invitation.email) !== actorEmail) {
    throw new AppError(403, 'Invitation email does not match the authenticated user', {
      code: 'WORKSPACE_INVITATION_EMAIL_MISMATCH',
    });
  }

  await prisma.$transaction(async (tx) => {
    const existingMembership = await tx.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: actor.userId,
        },
      },
      select: { userId: true },
    });

    if (existingMembership) {
      throw new AppError(409, 'User is already a workspace member', {
        code: 'WORKSPACE_MEMBER_ALREADY_EXISTS',
      });
    }

    await tx.workspaceMembership.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId: actor.userId,
        role: normalizeWorkspaceRole(invitation.role),
      },
    });

    await tx.workspaceInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'accepted',
        acceptedByUserId: actor.userId,
        acceptedAt: new Date(),
      },
    });
  });

  return { accepted: true as const };
}
