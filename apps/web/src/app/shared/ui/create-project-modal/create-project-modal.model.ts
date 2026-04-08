export type ProjectModalMode = 'create' | 'edit';

export interface ProjectModalInitialValues {
  name: string;
  description: string;
}

export type CreateProjectModalPayload = ProjectModalInitialValues;

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

export type EditProjectModalPayload = ProjectModalInitialValues;
