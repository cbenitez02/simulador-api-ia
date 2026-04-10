import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error-handler.js';
import type { AuthenticatedActor } from './types.js';

export function getAccessibleWorkspaceIds(actor: AuthenticatedActor): string[] {
  return actor.workspaceMemberships.map((membership) => membership.workspaceId);
}

export function requireWorkspaceAccess(
  actor: AuthenticatedActor,
  workspaceId: string | null
): string {
  if (!workspaceId) {
    throw new AppError(403, 'Workspace access is required for this resource', {
      code: 'WORKSPACE_ACCESS_REQUIRED',
    });
  }

  if (!getAccessibleWorkspaceIds(actor).includes(workspaceId)) {
    throw new AppError(403, 'You do not have access to this workspace', {
      code: 'WORKSPACE_ACCESS_DENIED',
    });
  }

  return workspaceId;
}

export function resolveDefaultWorkspaceId(actor: AuthenticatedActor): string {
  return requireWorkspaceAccess(actor, actor.personalWorkspaceId);
}

export async function authorizeProjectAccess(actor: AuthenticatedActor, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  requireWorkspaceAccess(actor, project.workspaceId);
  return project;
}

export async function authorizeEndpointAccess(actor: AuthenticatedActor, endpointId: string) {
  const endpoint = await prisma.endpoint.findUnique({
    where: { id: endpointId },
    select: {
      id: true,
      projectId: true,
      project: {
        select: {
          workspaceId: true,
        },
      },
    },
  });

  if (!endpoint) {
    throw new AppError(404, 'Endpoint not found');
  }

  requireWorkspaceAccess(actor, endpoint.project.workspaceId);
  return endpoint;
}
