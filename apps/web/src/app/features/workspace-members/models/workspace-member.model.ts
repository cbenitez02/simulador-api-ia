import type { WorkspaceRoleDto } from '../../../shared/http/api.types';

export interface WorkspaceMember {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: WorkspaceRoleDto;
  createdAt: string;
}
