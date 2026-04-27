import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type {
  UpdateWorkspaceMemberRoleDto,
  WorkspaceMemberDto,
  WorkspaceMembersListDto,
  WorkspaceRoleDto,
} from '../../../shared/http/api.types';
import type { WorkspaceMember } from '../models/workspace-member.model';

function mapWorkspaceMemberFromApi(member: WorkspaceMemberDto): WorkspaceMember {
  return {
    userId: member.userId,
    email: member.email,
    displayName: member.displayName,
    role: member.role,
    createdAt: member.createdAt,
  };
}

@Injectable({ providedIn: 'root' })
export class WorkspaceMembersRepository {
  private readonly api = inject(ApiClient);

  async listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const response = await this.api.get<WorkspaceMembersListDto>(`/workspaces/${workspaceId}/members`);
    return response.items.map(mapWorkspaceMemberFromApi);
  }

  async addMember(workspaceId: string, input: { email: string; role: WorkspaceRoleDto }): Promise<WorkspaceMember> {
    const member = await this.api.post<WorkspaceMemberDto, { email: string; role: WorkspaceRoleDto }>(
      `/workspaces/${workspaceId}/members`,
      input,
    );

    return mapWorkspaceMemberFromApi(member);
  }

  async updateMemberRole(
    workspaceId: string,
    memberUserId: string,
    input: UpdateWorkspaceMemberRoleDto,
  ): Promise<WorkspaceMember> {
    const member = await this.api.patch<WorkspaceMemberDto, UpdateWorkspaceMemberRoleDto>(
      `/workspaces/${workspaceId}/members/${memberUserId}`,
      input,
    );

    return mapWorkspaceMemberFromApi(member);
  }

  removeMember(workspaceId: string, memberUserId: string): Promise<void> {
    return this.api.delete(`/workspaces/${workspaceId}/members/${memberUserId}`);
  }
}
