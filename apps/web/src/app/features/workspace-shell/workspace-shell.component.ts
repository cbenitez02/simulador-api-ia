import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DEMO_DASHBOARD_PROJECT, MOCK_DASHBOARD_PROJECTS } from '../main-dashboard/data/dashboard-projects.mock';
import { CreateEndpointPageComponent } from '../endpoints/components/create-endpoint-page/create-endpoint-page.component';
import { EndpointDetailPanelComponent } from '../endpoints/components/endpoint-detail-panel/endpoint-detail-panel.component';
import { EndpointsPageComponent } from '../endpoints/endpoints-page.component';
import { LogsComponent } from '../logs/logs.component';
import { LogsDetailSidebarComponent } from '../logs/components/logs-detail-sidebar/logs-detail-sidebar.component';
import { DashboardEmptyStateComponent } from '../main-dashboard/components/dashboard-empty-state/dashboard-empty-state.component';
import { MainDashboardDataComponent } from '../main-dashboard/components/main-dashboard-data/main-dashboard-data.component';
import { MainDashboardSidebarComponent } from '../main-dashboard/components/main-dashboard-sidebar/main-dashboard-sidebar.component';
import { MainDashboardUtilitySidebarComponent } from '../main-dashboard/components/main-dashboard-utility-sidebar/main-dashboard-utility-sidebar.component';
import { GlobalConfigDrawerComponent } from '../global-config/components/global-config-drawer/global-config-drawer.component';
import { createDefaultGlobalConfig, type GlobalConfig } from '../global-config/models/global-config.model';
import { CreateProjectModalComponent } from '../../shared/ui/create-project-modal/create-project-modal.component';
import type {
  CreateProjectModalPayload,
  CreateProjectWithEndpointPayload,
} from '../../shared/ui/create-project-modal/create-project-modal.model';
import type { DashboardProject } from '../main-dashboard/models/dashboard-project.model';
import type { SidebarProjectRow, WorkspaceNavId } from './models/workspace-shell.model';
import type { ApiLogEntry } from '../logs/models/api-log.model';
import type { EndpointPreview } from '../../shared/models/endpoint-preview.model';

function cloneDashboardProjects(source: DashboardProject[]): DashboardProject[] {
  return source.map((p) => ({
    ...p,
    endpoints: p.endpoints.map((e) => ({ ...e })),
  }));
}

/**
 * Estructura global del simulador: navegación, proyecto activo, paneles y vistas por sección.
 */
@Component({
  selector: 'app-workspace-shell',
  standalone: true,
  imports: [
    CreateEndpointPageComponent,
    EndpointDetailPanelComponent,
    EndpointsPageComponent,
    LogsComponent,
    LogsDetailSidebarComponent,
    DashboardEmptyStateComponent,
    MainDashboardDataComponent,
    MainDashboardSidebarComponent,
    MainDashboardUtilitySidebarComponent,
    GlobalConfigDrawerComponent,
    CreateProjectModalComponent,
  ],
  templateUrl: './workspace-shell.component.html',
  styleUrls: ['./workspace-shell.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShellComponent {
  /**
   * Preloaded mock catalog (E-commerce, Auth, Payments). Cloned so edits stay local.
   * `loadDemoProject()` replaces the list with the single demo project; new projects append via the modal.
   */
  protected readonly projects = signal<DashboardProject[]>(cloneDashboardProjects(MOCK_DASHBOARD_PROJECTS));
  protected readonly selectedProjectId = signal<string>(MOCK_DASHBOARD_PROJECTS[0]?.id ?? '');
  protected readonly activeNav = signal<WorkspaceNavId>('dashboard');

  protected readonly sidebarProjects = computed((): SidebarProjectRow[] =>
    this.projects().map((p) => ({
      id: p.id,
      name: p.name,
      mockUrl: p.mockUrl,
      endpointCount: p.endpoints.length,
    })),
  );

  protected readonly hasProjects = computed(() => this.projects().length > 0);

  protected readonly activeProject = computed((): DashboardProject | null => {
    const list = this.projects();
    if (!list.length) return null;
    const id = this.selectedProjectId();
    return list.find((p) => p.id === id) ?? list[0]!;
  });

  protected readonly endpoints = computed(() => this.activeProject()?.endpoints ?? []);

  protected readonly apiBaseUrl = computed(() => this.activeProject()?.mockUrl ?? '');

  protected readonly selectedEndpointId = signal<string | null>(null);

  protected readonly selectedLog = signal<ApiLogEntry | null>(null);

  protected readonly globalConfigDrawerOpen = signal(false);
  protected readonly globalConfig = signal<GlobalConfig>(createDefaultGlobalConfig());

  protected readonly createProjectModalOpen = signal(false);
  protected readonly createProjectModalLoading = signal(false);

  /** Full-page create/edit endpoint wizard (replaces main column while open). */
  protected readonly createEndpointFlowOpen = signal(false);
  /** When set, the wizard opens in edit mode with this endpoint. */
  protected readonly endpointWizardInitial = signal<EndpointPreview | null>(null);
  /** Nav section before opening the wizard; restored on cancel (not on save). */
  protected readonly navBeforeCreateFlow = signal<WorkspaceNavId | null>(null);

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

  protected openCreateProjectModal(): void {
    this.createProjectModalOpen.set(true);
  }

  protected onCreateProjectModalDismiss(): void {
    if (this.createProjectModalLoading()) return;
    this.createProjectModalOpen.set(false);
  }

  protected onCreateProjectModalProjectOnly(payload: CreateProjectModalPayload): void {
    this.addProjectFromModalData(payload.name, payload.description, []);
    this.createProjectModalOpen.set(false);
  }

  protected onCreateProjectModalWithEndpoint(payload: CreateProjectWithEndpointPayload): void {
    this.createProjectModalLoading.set(true);
    window.setTimeout(() => {
      const ep = this.buildStubEndpointFromPrompt(payload.endpointPrompt);
      this.addProjectFromModalData(payload.name, payload.description, [ep]);
      this.createProjectModalLoading.set(false);
      this.createProjectModalOpen.set(false);
    }, 1000);
  }

  private addProjectFromModalData(name: string, description: string, endpoints: EndpointPreview[]): void {
    const slug = `project-${Date.now().toString(36)}`;
    const project: DashboardProject = {
      id: slug,
      name: name.trim() || 'New project',
      mockUrl: `https://mock.api.simulator/${slug}`,
      description: description.trim() || 'Your mock API workspace.',
      lastUpdatedRelative: 'Just now',
      endpoints,
    };
    this.projects.update((list) => [...list, project]);
    this.selectedProjectId.set(project.id);
    this.selectedLog.set(null);
    this.closeCreateEndpointWizard(true);
  }

  private buildStubEndpointFromPrompt(prompt: string): EndpointPreview {
    const trimmed = prompt.trim();
    const m = trimmed.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/i);
    const method = (m?.[1]?.toUpperCase() as EndpointPreview['method']) || 'GET';
    let path = (m?.[2] ?? '/generated').replace(/['"`]/g, '');
    if (!path.startsWith('/')) path = `/${path}`;
    const id = `ep-${Date.now().toString(36)}`;
    return {
      id,
      method,
      path,
      description: trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed || 'Generated endpoint',
      latencyMs: 120,
      statusCode: 200,
      responseBody: {
        _mock: true,
        note: 'Placeholder response — replace in editor.',
      },
      responseHeaders: { 'content-type': 'application/json' },
    };
  }

  /** Quick-add without modal (e.g. tests). */
  protected createBlankProject(): void {
    this.addProjectFromModalData(
      this.projects().length === 0 ? 'My first project' : 'New project',
      'Your mock API workspace.',
      [],
    );
  }

  protected loadDemoProject(): void {
    const demo = DEMO_DASHBOARD_PROJECT;
    this.projects.set([demo]);
    this.selectedProjectId.set(demo.id);
    this.selectedLog.set(null);
    this.closeCreateEndpointWizard(true);
  }

  protected selectProject(id: string): void {
    const project = this.projects().find((p) => p.id === id) ?? this.projects()[0];
    if (!project) return;
    this.selectedProjectId.set(project.id);
    const sel = this.selectedEndpointId();
    if (sel && !project.endpoints.some((e) => e.id === sel)) {
      this.selectedEndpointId.set(null);
    }
    this.selectedLog.set(null);
    this.closeCreateEndpointWizard(true);
  }

  protected selectNav(id: WorkspaceNavId): void {
    this.activeNav.set(id);
    if (id !== 'endpoints') {
      this.selectedEndpointId.set(null);
      this.createEndpointFlowOpen.set(false);
      this.endpointWizardInitial.set(null);
      this.navBeforeCreateFlow.set(null);
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
    if (!this.hasProjects()) return;
    this.navBeforeCreateFlow.set(this.activeNav());
    this.activeNav.set('endpoints');
    this.selectedEndpointId.set(null);
    this.endpointWizardInitial.set(null);
    this.createEndpointFlowOpen.set(true);
  }

  protected editEndpoint(ep: EndpointPreview): void {
    if (!this.hasProjects()) return;
    this.navBeforeCreateFlow.set(this.activeNav());
    this.activeNav.set('endpoints');
    this.endpointWizardInitial.set(ep);
    this.createEndpointFlowOpen.set(true);
  }

  /**
   * @param restorePreviousNav When true (e.g. user cancelled), return to the section that was active before the wizard opened.
   */
  protected closeCreateEndpointWizard(restorePreviousNav = false): void {
    this.createEndpointFlowOpen.set(false);
    this.endpointWizardInitial.set(null);
    if (restorePreviousNav) {
      const prev = this.navBeforeCreateFlow();
      if (prev !== null) {
        this.activeNav.set(prev);
      }
    }
    this.navBeforeCreateFlow.set(null);
  }

  protected onEndpointSaved(ep: EndpointPreview): void {
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (!projectId) return;
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
    this.closeCreateEndpointWizard(false);
  }

  protected deleteEndpoint(endpointId: string): void {
    const projectId = this.selectedProjectId() || this.activeProject()?.id;
    if (!projectId) return;
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

  protected editGlobalConfig(): void {
    this.globalConfigDrawerOpen.set(true);
  }

  protected onGlobalConfigDrawerClose(): void {
    this.globalConfigDrawerOpen.set(false);
  }

  protected onGlobalConfigSaved(cfg: GlobalConfig): void {
    this.globalConfig.set(cfg);
    this.globalConfigDrawerOpen.set(false);
  }
}
