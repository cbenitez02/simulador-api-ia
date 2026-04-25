export const WORKSPACE_ROLE_VALUES = ['owner', 'editor', 'viewer'] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLE_VALUES)[number];

export interface ResolvedExternalIdentity {
  provider: string;
  subject: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
}

export interface WorkspaceMembershipActor {
  workspaceId: string;
  role: WorkspaceRole;
}

export interface WorkspaceCapabilities {
  canEdit: boolean;
  canManageMembers: boolean;
}

export interface WorkspaceAccessSummary {
  id: string;
  role: WorkspaceRole;
  isPersonal: boolean;
  capabilities: WorkspaceCapabilities;
}

export interface AuthenticatedActor {
  userId: string;
  personalWorkspaceId: string | null;
  identity: {
    provider: string;
    subject: string;
  };
  workspaceMemberships: WorkspaceMembershipActor[];
}
