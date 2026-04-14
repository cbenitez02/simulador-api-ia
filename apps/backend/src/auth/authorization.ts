import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error-handler.js';
import type {
  AuthenticatedActor,
  WorkspaceAccessSummary,
  WorkspaceMembershipActor,
  WorkspaceRole,
} from './types.js';

export type WorkspaceAccessLevel = 'read' | 'mutate' | 'owner';

function normalizeWorkspaceRole(role: string): WorkspaceRole {
  switch (role) {
    case 'owner':
    case 'editor':
    case 'viewer':
      return role;
    default:
      return 'viewer';
  }
}

function getWorkspaceMembership(
  actor: AuthenticatedActor,
  workspaceId: string
): WorkspaceMembershipActor | null {
  const membership = actor.workspaceMemberships.find((item) => item.workspaceId === workspaceId);

  if (!membership) {
    return null;
  }

  return {
    workspaceId: membership.workspaceId,
    role: normalizeWorkspaceRole(membership.role),
  };
}

export function getWorkspaceCapabilities(
  role: WorkspaceRole
): WorkspaceAccessSummary['capabilities'] {
  return {
    canEdit: role === 'owner' || role === 'editor',
    canManageMembers: role === 'owner',
  };
}

function assertWorkspaceLevel(role: WorkspaceRole, level: WorkspaceAccessLevel): void {
  const capabilities = getWorkspaceCapabilities(role);

  if (level === 'mutate' && !capabilities.canEdit) {
    throw new AppError(403, 'You do not have permission to modify this workspace', {
      code: 'WORKSPACE_MUTATION_DENIED',
    });
  }

  if (level === 'owner' && role !== 'owner') {
    throw new AppError(403, 'Only workspace owners can manage members', {
      code: 'WORKSPACE_OWNER_REQUIRED',
    });
  }
}

export function getAccessibleWorkspaceIds(actor: AuthenticatedActor): string[] {
  return actor.workspaceMemberships.map((membership) => membership.workspaceId);
}

export function requireWorkspaceAccess(
  actor: AuthenticatedActor,
  workspaceId: string | null,
  level: WorkspaceAccessLevel = 'read'
): string {
  if (!workspaceId) {
    throw new AppError(403, 'Workspace access is required for this resource', {
      code: 'WORKSPACE_ACCESS_REQUIRED',
    });
  }

  const membership = getWorkspaceMembership(actor, workspaceId);

  if (!membership) {
    throw new AppError(403, 'You do not have access to this workspace', {
      code: 'WORKSPACE_ACCESS_DENIED',
    });
  }

  assertWorkspaceLevel(membership.role, level);

  return workspaceId;
}

export function resolveWorkspaceAccess(
  actor: AuthenticatedActor,
  workspaceId: string | null
): WorkspaceAccessSummary {
  const resolvedWorkspaceId = requireWorkspaceAccess(actor, workspaceId, 'read');
  const membership = getWorkspaceMembership(actor, resolvedWorkspaceId);

  if (!membership) {
    throw new AppError(403, 'You do not have access to this workspace', {
      code: 'WORKSPACE_ACCESS_DENIED',
    });
  }

  return {
    id: resolvedWorkspaceId,
    role: membership.role,
    capabilities: getWorkspaceCapabilities(membership.role),
  };
}

export function resolveDefaultWorkspaceId(actor: AuthenticatedActor): string {
  return requireWorkspaceAccess(actor, actor.personalWorkspaceId, 'mutate');
}

export async function authorizeProjectAccess(
  actor: AuthenticatedActor,
  projectId: string,
  level: WorkspaceAccessLevel = 'read'
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  requireWorkspaceAccess(actor, project.workspaceId, level);
  return project;
}

export async function authorizeEndpointAccess(
  actor: AuthenticatedActor,
  endpointId: string,
  level: WorkspaceAccessLevel = 'read'
) {
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

  requireWorkspaceAccess(actor, endpoint.project.workspaceId, level);
  return endpoint;
}
