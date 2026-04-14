import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideClock,
  LucideDownload,
  LucideGitBranch,
  LucidePlay,
  LucidePlus,
  LucideSettings,
  LucideUpload,
} from '@lucide/angular';

import type { DashboardProject } from '../../models/dashboard-project.model';
import type { WorkspaceRoleDto } from '../../../../shared/http/api.types';
import type { WorkspaceMember } from '../../../workspace-members/models/workspace-member.model';

export interface UtilitySidebarRequestItem {
  id: string;
  requestLabel: string;
  statusCode: number;
  latencyMs: number;
  scenarioType: string;
  timeLabel: string;
}

interface UtilityQuickAction {
  id: 'create' | 'test' | 'export' | 'import';
  title: string;
  subtitle: string;
  icon: 'plus' | 'play' | 'download' | 'upload';
  disabled?: boolean;
}

@Component({
  selector: 'app-main-dashboard-utility-sidebar',
  templateUrl: './main-dashboard-utility-sidebar.component.html',
  styleUrls: ['./main-dashboard-utility-sidebar.component.css'],
  standalone: true,
  imports: [
    FormsModule,
    LucideClock,
    LucideDownload,
    LucideGitBranch,
    LucidePlay,
    LucidePlus,
    LucideSettings,
    LucideUpload,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDashboardUtilitySidebarComponent {
  readonly project = input.required<DashboardProject>();
  readonly canMutate = input(true);
  readonly workspaceMembers = input<WorkspaceMember[]>([]);
  readonly workspaceMembersLoading = input(false);
  readonly workspaceMembersError = input<string | null>(null);
  readonly workspaceMemberMutationPending = input(false);

  readonly createEndpoint = output<void>();
  readonly testAllEndpoints = output<void>();
  readonly exportConfig = output<void>();
  readonly importEndpoints = output<void>();
  readonly editGlobalConfig = output<void>();
  readonly addWorkspaceMember = output<{ email: string; role: WorkspaceRoleDto }>();
  readonly removeWorkspaceMember = output<string>();

  protected readonly quickActions: UtilityQuickAction[] = [
    {
      id: 'create',
      title: 'Create endpoint',
      subtitle: 'Add a new mock endpoint',
      icon: 'plus' as const,
    },
    {
      id: 'test',
      title: 'Test all endpoints',
      subtitle: 'Coming soon — bulk testing is not available yet',
      icon: 'play' as const,
      disabled: true,
    },
    {
      id: 'export',
      title: 'Export config',
      subtitle: 'Download project as JSON',
      icon: 'download' as const,
    },
    {
      id: 'import',
      title: 'Import endpoints',
      subtitle: 'Bulk import from file',
      icon: 'upload' as const,
    },
  ];

  protected readonly recentRequests = computed((): UtilitySidebarRequestItem[] =>
    this.project().recentRequests.map((request) => ({
      id: request.id,
      requestLabel: `${request.method} ${request.path}`,
      statusCode: request.statusCode,
      latencyMs: request.latencyMs,
      scenarioType: request.scenarioType,
      timeLabel: request.timeLabel,
    })),
  );

  protected readonly globalConfigRows = computed(() => {
    const config = this.project().configSummary;

    return [
      {
        label: 'Default latency',
        badge: config.latency.enabled
          ? config.latency.mode === 'range'
            ? `${config.latency.minMs}–${config.latency.maxMs}ms`
            : `${config.latency.maxMs}ms`
          : 'Disabled',
        tone: config.latency.enabled ? ('neutral' as const) : ('neutral' as const),
      },
      {
        label: 'Error simulation',
        badge: config.errorSimulation.enabled
          ? `${config.errorSimulation.ratePct}% · ${config.errorSimulation.codes.join(', ')}`
          : 'Disabled',
        tone: config.errorSimulation.enabled ? ('success' as const) : ('neutral' as const),
      },
      {
        label: 'Rate limiting',
        badge: config.rateLimiting.enabled ? `${config.rateLimiting.rpm} req/min` : 'Disabled',
        tone: 'neutral' as const,
      },
      {
        label: 'Logging',
        badge: config.logging.level === 'full' ? 'Full' : config.logging.level === 'off' ? 'Off' : 'Basic',
        tone: 'neutral' as const,
      },
    ];
  });

  protected readonly workspaceRoleLabel = computed(() => {
    switch (this.project().workspace.role) {
      case 'owner':
        return 'Owner';
      case 'editor':
        return 'Editor';
      default:
        return 'Viewer';
    }
  });

  protected readonly canManageMembers = computed(() => this.project().workspace.capabilities.canManageMembers);

  protected addMember(email: string, role: string): void {
    if (!this.canManageMembers() || this.workspaceMemberMutationPending()) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;

    const nextRole: WorkspaceRoleDto = role === 'owner' || role === 'editor' ? role : 'viewer';
    this.addWorkspaceMember.emit({ email: normalizedEmail, role: nextRole });
  }

  protected onRemoveMember(memberUserId: string): void {
    if (!this.canManageMembers() || this.workspaceMemberMutationPending()) return;
    this.removeWorkspaceMember.emit(memberUserId);
  }

  protected onQuickAction(id: string): void {
    const action = this.quickActions.find((item) => item.id === id);
    if (action?.disabled) {
      return;
    }

    switch (id) {
      case 'create':
        if (!this.canMutate()) return;
        this.createEndpoint.emit();
        break;
      case 'test':
        this.testAllEndpoints.emit();
        break;
      case 'export':
        if (!this.canMutate()) return;
        this.exportConfig.emit();
        break;
      case 'import':
        if (!this.canMutate()) return;
        this.importEndpoints.emit();
        break;
      default:
        break;
    }
  }
}
