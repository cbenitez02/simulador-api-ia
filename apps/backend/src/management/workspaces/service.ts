import type { AuthenticatedActor } from '../../auth/types.js';
import { summarizeWorkspaceAccess } from '../../auth/authorization.js';
import { prisma } from '../../lib/prisma.js';
import type { CreateWorkspaceInput } from './schema.js';

export async function listWorkspaces(actor: AuthenticatedActor) {
  const memberships = await prisma.workspaceMembership.findMany({
    where: {
      userId: actor.userId,
    },
    orderBy: [{ createdAt: 'asc' }, { workspaceId: 'asc' }],
    select: {
      workspaceId: true,
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          kind: true,
        },
      },
    },
  });

  return {
    items: memberships.map((membership) => summarizeWorkspaceAccess(actor, membership.workspace)),
  };
}

export async function createWorkspace(actor: AuthenticatedActor, input: CreateWorkspaceInput) {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: input.name.trim(),
        kind: 'team',
      },
      select: {
        id: true,
        name: true,
        kind: true,
      },
    });

    await tx.workspaceMembership.create({
      data: {
        workspaceId: workspace.id,
        userId: actor.userId,
        role: 'owner',
      },
    });

    return summarizeWorkspaceAccess(
      {
        ...actor,
        workspaceMemberships: [
          ...actor.workspaceMemberships,
          { workspaceId: workspace.id, role: 'owner' },
        ],
      },
      workspace,
      'owner'
    );
  });
}
