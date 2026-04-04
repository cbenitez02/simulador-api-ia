export interface CreateProjectModalPayload {
  name: string;
  description: string;
}

export interface CreateProjectWithEndpointPayload extends CreateProjectModalPayload {
  endpointPrompt: string;
}
