/** Secciones principales del workspace (barra lateral + área central). */
export type WorkspaceNavId = 'dashboard' | 'endpoints' | 'logs' | 'settings';

export interface SidebarProjectRow {
  id: string;
  name: string;
  mockUrl: string;
  endpointCount: number;
}
