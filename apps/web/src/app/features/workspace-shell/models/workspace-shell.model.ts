/** Secciones principales del workspace (barra lateral + área central). */
export type WorkspaceNavId =
  | 'dashboard'
  | 'endpoints'
  | 'logs'
  | 'history'
  | 'workspace'
  | 'account-profile-settings'
  | 'account-usage'
  | 'account-plan-billing';

export interface SidebarProjectRow {
  id: string;
  name: string;
  mockUrl: string;
  endpointCount: number;
}

export interface SidebarProjectPaginationState {
  loaded: number;
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  errorMessage: string | null;
}

export interface PaginationState {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface EndpointListState extends PaginationState {
  q: string;
  method: 'all' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  sort: 'path-asc' | 'path-desc' | 'method';
}

export interface CreateProjectAiFlowState {
  createdProjectId: string;
  projectName: string;
  endpointPrompt: string;
  message: string;
  retryable: boolean;
}

export interface SnapshotHistoryState {
  loadedForProjectId: string | null;
  latestSnapshotId: string | null;
}
