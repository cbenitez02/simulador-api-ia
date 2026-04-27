import type { WorkspaceSummaryDto } from '../../http/api.types';

export type ProjectModalMode = 'create' | 'edit';

export type ProjectModalWorkspaceOption = WorkspaceSummaryDto;

export interface ProjectModalInitialValues {
  name: string;
  description: string;
  slug?: string;
  workspaceId?: string;
}

export interface CreateProjectModalPayload extends ProjectModalInitialValues {
  workspaceId?: string;
}

export interface CreateProjectWithEndpointPayload extends CreateProjectModalPayload {
  endpointPrompt: string;
}

export interface CreateProjectPartialSuccessState {
  createdProjectId: string;
  projectName: string;
  endpointPrompt: string;
  message: string;
  retryable: boolean;
}

export interface EditProjectModalPayload {
  name: string;
  description: string;
  slug: string;
  workspaceId?: string;
}
