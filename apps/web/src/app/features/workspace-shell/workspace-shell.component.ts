import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { MOCK_DASHBOARD_PROJECTS } from '../main-dashboard/data/dashboard-projects.mock';
import { CreateEndpointDrawerComponent } from '../endpoints/components/create-endpoint-drawer/create-endpoint-drawer.component';
import { EndpointDetailPanelComponent } from '../endpoints/components/endpoint-detail-panel/endpoint-detail-panel.component';
import { EndpointsPageComponent } from '../endpoints/endpoints-page.component';
import { LogsComponent } from '../logs/logs.component';
import { LogsDetailSidebarComponent } from '../logs/components/logs-detail-sidebar/logs-detail-sidebar.component';
import { MainDashboardDataComponent } from '../main-dashboard/components/main-dashboard-data/main-dashboard-data.component';
import { MainDashboardSidebarComponent } from '../main-dashboard/components/main-dashboard-sidebar/main-dashboard-sidebar.component';
import { MainDashboardUtilitySidebarComponent } from '../main-dashboard/components/main-dashboard-utility-sidebar/main-dashboard-utility-sidebar.component';
import type { DashboardProject } from '../main-dashboard/models/dashboard-project.model';
import type { SidebarProjectRow, WorkspaceNavId } from './models/workspace-shell.model';
import type { ApiLogEntry } from '../logs/models/api-log.model';
import type { EndpointPreview } from '../../shared/models/endpoint-preview.model';

const defaultProject = MOCK_DASHBOARD_PROJECTS.find((p) => p.id === 'auth') ?? MOCK_DASHBOARD_PROJECTS[0]!;

/**
 * Estructura global del simulador: navegación, proyecto activo, paneles y vistas por sección.
 */
@Component({
  selector: 'app-workspace-shell',
  standalone: true,
  imports: [
    CreateEndpointDrawerComponent,
    EndpointDetailPanelComponent,
    EndpointsPageComponent,
    LogsComponent,
    LogsDetailSidebarComponent,
    MainDashboardDataComponent,
    MainDashboardSidebarComponent,
    MainDashboardUtilitySidebarComponent,
  ],
  templateUrl: './workspace-shell.component.html',
  styleUrls: ['./workspace-shell.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShellComponent {
  protected readonly projects = signal<DashboardProject[]>(MOCK_DASHBOARD_PROJECTS);
  protected readonly selectedProjectId = signal(defaultProject.id);
  protected readonly activeNav = signal<WorkspaceNavId>('dashboard');

  protected readonly sidebarProjects = computed((): SidebarProjectRow[] =>
    this.projects().map((p) => ({
      id: p.id,
      name: p.name,
      mockUrl: p.mockUrl,
      endpointCount: p.endpoints.length,
    })),
  );

  protected readonly activeProject = computed(() => {
    const id = this.selectedProjectId();
    return this.projects().find((p) => p.id === id) ?? this.projects()[0]!;
  });

  protected readonly endpoints = computed(() => this.activeProject().endpoints);

  protected readonly apiBaseUrl = computed(() => this.activeProject().mockUrl);

  protected readonly selectedEndpointId = signal<string | null>(null);

  protected readonly selectedLog = signal<ApiLogEntry | null>(null);

  protected readonly createEndpointDrawerOpen = signal(false);
  /** When set, the drawer opens in edit mode with this endpoint. */
  protected readonly endpointDrawerInitial = signal<EndpointPreview | null>(null);

  protected readonly selectedEndpoint = computed((): EndpointPreview | null => {
    const id = this.selectedEndpointId();
    if (!id) return null;
    return this.endpoints().find((e) => e.id === id) ?? null;
  });

  protected readonly placeholderTitle = computed(() => {
    switch (this.activeNav()) {
      case 'settings':
        return 'Settings';
      default:
        return '';
    }
  });

  protected readonly placeholderSub = computed(() => {
    switch (this.activeNav()) {
      case 'settings':
        return 'Workspace and simulator preferences.';
      default:
        return '';
    }
  });

  protected readonly placeholderLabel = computed(() => this.placeholderTitle() || 'Section');

  protected selectProject(id: string): void {
    const project = this.projects().find((p) => p.id === id) ?? this.projects()[0];
    if (!project) return;
    this.selectedProjectId.set(project.id);
    const sel = this.selectedEndpointId();
    if (sel && !project.endpoints.some((e) => e.id === sel)) {
      this.selectedEndpointId.set(null);
    }
    this.selectedLog.set(null);
  }

  protected selectNav(id: WorkspaceNavId): void {
    this.activeNav.set(id);
    if (id !== 'endpoints') {
      this.selectedEndpointId.set(null);
    }
    if (id !== 'logs') {
      this.selectedLog.set(null);
    }
  }

  protected selectEndpoint(id: string): void {
    this.selectedEndpointId.set(id);
  }

  protected clearEndpointSelection(): void {
    this.selectedEndpointId.set(null);
  }

  protected clearLogSelection(): void {
    this.selectedLog.set(null);
  }

  protected createEndpoint(): void {
    this.endpointDrawerInitial.set(null);
    this.createEndpointDrawerOpen.set(true);
  }

  protected editEndpoint(ep: EndpointPreview): void {
    this.endpointDrawerInitial.set(ep);
    this.createEndpointDrawerOpen.set(true);
  }

  protected closeCreateEndpointDrawer(): void {
    this.createEndpointDrawerOpen.set(false);
    this.endpointDrawerInitial.set(null);
  }

  protected onEndpointSaved(ep: EndpointPreview): void {
    const projectId = this.selectedProjectId();
    this.projects.update((list) =>
      list.map((p) => {
        if (p.id !== projectId) return p;
        const idx = p.endpoints.findIndex((e) => e.id === ep.id);
        if (idx === -1) {
          return { ...p, endpoints: [...p.endpoints, ep] };
        }
        const next = [...p.endpoints];
        next[idx] = ep;
        return { ...p, endpoints: next };
      }),
    );
    this.selectedEndpointId.set(ep.id);
    this.activeNav.set('endpoints');
  }

  protected deleteEndpoint(endpointId: string): void {
    const projectId = this.selectedProjectId();
    this.projects.update((list) =>
      list.map((p) => (p.id === projectId ? { ...p, endpoints: p.endpoints.filter((e) => e.id !== endpointId) } : p)),
    );
    if (this.selectedEndpointId() === endpointId) {
      this.selectedEndpointId.set(null);
    }
  }

  protected openLogs(): void {
    this.activeNav.set('logs');
  }

  protected testAllEndpoints(): void {}

  protected exportConfig(): void {}

  protected importEndpoints(): void {}

  protected editGlobalConfig(): void {}
}
