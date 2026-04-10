export interface ResolvedExternalIdentity {
  provider: string;
  subject: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
}

export interface WorkspaceMembershipActor {
  workspaceId: string;
  role: string;
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
