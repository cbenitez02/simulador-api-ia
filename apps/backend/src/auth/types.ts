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
  canRestoreSnapshots: boolean;
  canImportContracts: boolean;
}

export interface WorkspaceAccessSummary {
  id: string;
  name: string;
  kind: 'personal' | 'team';
  role: WorkspaceRole;
  isPersonal: boolean;
  capabilities: WorkspaceCapabilities;
}

export interface AuthenticatedActor {
  userId: string;
  email: string | null;
  displayName: string | null;
  personalWorkspaceId: string | null;
  identity: {
    provider: string;
    subject: string;
  };
  workspaceMemberships: WorkspaceMembershipActor[];
}
