import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error-handler.js';
import type {
  AuthenticatedActor,
  WorkspaceCapabilities,
  WorkspaceAccessSummary,
  WorkspaceMembershipActor,
  WorkspaceRole,
} from './types.js';

type WorkspaceSummaryRecord = {
  id: string;
  name: string;
  kind: string;
};

export type WorkspaceAccessLevel = 'read' | 'mutate' | 'owner';
export type WorkspaceCapabilityKey = 'canRestoreSnapshots' | 'canImportContracts';

const WORKSPACE_CAPABILITY_ERRORS: Record<
  WorkspaceCapabilityKey,
  { message: string; code: string }
> = {
  canRestoreSnapshots: {
    message: 'You do not have permission to restore project snapshots',
    code: 'WORKSPACE_SNAPSHOT_RESTORE_DENIED',
  },
  canImportContracts: {
    message: 'You do not have permission to import OpenAPI contracts',
    code: 'WORKSPACE_CONTRACT_IMPORT_DENIED',
  },
};

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
    canRestoreSnapshots: role === 'owner',
    canImportContracts: role === 'owner',
  };
}

export function requireWorkspaceCapability(
  role: WorkspaceRole,
  capability: WorkspaceCapabilityKey,
  capabilities: WorkspaceCapabilities = getWorkspaceCapabilities(role)
): void {
  if (capabilities[capability]) {
    return;
  }

  const error = WORKSPACE_CAPABILITY_ERRORS[capability];
  throw new AppError(403, error.message, {
    code: error.code,
  });
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
    name: resolvedWorkspaceId,
    kind: actor.personalWorkspaceId === resolvedWorkspaceId ? 'personal' : 'team',
    role: membership.role,
    isPersonal: actor.personalWorkspaceId === resolvedWorkspaceId,
    capabilities: getWorkspaceCapabilities(membership.role),
  };
}

export function summarizeWorkspaceAccess(
  actor: AuthenticatedActor,
  workspace: WorkspaceSummaryRecord | string | null,
  level: WorkspaceAccessLevel = 'read'
): WorkspaceAccessSummary {
  const workspaceId = requireWorkspaceAccess(
    actor,
    typeof workspace === 'string' ? workspace : (workspace?.id ?? null),
    level
  );

  const membership = getWorkspaceMembership(actor, workspaceId);

  if (!membership) {
    throw new AppError(403, 'You do not have access to this workspace', {
      code: 'WORKSPACE_ACCESS_DENIED',
    });
  }

  return {
    id: workspaceId,
    name: typeof workspace === 'object' && workspace ? workspace.name : workspaceId,
    kind:
      typeof workspace === 'object' && workspace?.kind === 'personal'
        ? 'personal'
        : actor.personalWorkspaceId === workspaceId
          ? 'personal'
          : 'team',
    role: membership.role,
    isPersonal: actor.personalWorkspaceId === workspaceId,
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

export async function authorizeProjectCapability(
  actor: AuthenticatedActor,
  projectId: string,
  capability: WorkspaceCapabilityKey
) {
  const project = await authorizeProjectAccess(actor, projectId, 'read');
  const membership = getWorkspaceMembership(actor, project.workspaceId ?? '');

  if (!membership) {
    throw new AppError(403, 'You do not have access to this workspace', {
      code: 'WORKSPACE_ACCESS_DENIED',
    });
  }

  requireWorkspaceCapability(membership.role, capability);
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
