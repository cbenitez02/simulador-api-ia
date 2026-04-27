import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type {
  InvitableWorkspaceRoleDto,
  WorkspaceInvitationDto,
  WorkspaceInvitationsListDto,
} from '../../../shared/http/api.types';

@Injectable({ providedIn: 'root' })
export class WorkspaceInvitationsRepository {
  private readonly api = inject(ApiClient);

  async listWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitationDto[]> {
    const response = await this.api.get<WorkspaceInvitationsListDto>(`/workspaces/${workspaceId}/invitations`);
    return response.items;
  }

  createInvitation(
    workspaceId: string,
    input: { email: string; role: InvitableWorkspaceRoleDto },
  ): Promise<WorkspaceInvitationDto> {
    return this.api.post<WorkspaceInvitationDto, { email: string; role: InvitableWorkspaceRoleDto }>(
      `/workspaces/${workspaceId}/invitations`,
      input,
    );
  }

  revokeInvitation(workspaceId: string, invitationId: string): Promise<void> {
    return this.api.delete(`/workspaces/${workspaceId}/invitations/${invitationId}`);
  }

  async listPendingInvitations(): Promise<WorkspaceInvitationDto[]> {
    const response = await this.api.get<WorkspaceInvitationsListDto>('/workspace-invitations/pending');
    return response.items;
  }

  acceptInvitation(invitationId: string): Promise<{ accepted: true }> {
    return this.api.post<{ accepted: true }, Record<string, never>>(
      `/workspace-invitations/${invitationId}/accept`,
      {},
    );
  }
}
