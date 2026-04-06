export type ProjectModalMode = 'create' | 'edit';

export interface ProjectModalInitialValues {
  name: string;
  description: string;
}

export type CreateProjectModalPayload = ProjectModalInitialValues;

export interface CreateProjectWithEndpointPayload extends CreateProjectModalPayload {
  endpointPrompt: string;
}

export type EditProjectModalPayload = ProjectModalInitialValues;
