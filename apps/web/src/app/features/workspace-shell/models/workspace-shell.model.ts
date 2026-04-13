/** Secciones principales del workspace (barra lateral + área central). */
export type WorkspaceNavId = 'dashboard' | 'endpoints' | 'logs';

export interface SidebarProjectRow {
  id: string;
  name: string;
  mockUrl: string;
  endpointCount: number;
}

export interface CreateProjectAiFlowState {
  createdProjectId: string;
  projectName: string;
  endpointPrompt: string;
  message: string;
  retryable: boolean;
}
