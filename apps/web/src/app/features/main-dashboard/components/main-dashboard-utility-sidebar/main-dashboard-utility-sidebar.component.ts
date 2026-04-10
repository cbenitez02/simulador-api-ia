import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
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

export interface UtilitySidebarRequestItem {
  id: string;
  requestLabel: string;
  statusCode: number;
  latencyMs: number;
  scenarioType: string;
  timeLabel: string;
}

@Component({
  selector: 'app-main-dashboard-utility-sidebar',
  templateUrl: './main-dashboard-utility-sidebar.component.html',
  styleUrls: ['./main-dashboard-utility-sidebar.component.css'],
  standalone: true,
  imports: [LucideClock, LucideDownload, LucideGitBranch, LucidePlay, LucidePlus, LucideSettings, LucideUpload],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDashboardUtilitySidebarComponent {
  readonly project = input.required<DashboardProject>();

  readonly createEndpoint = output<void>();
  readonly testAllEndpoints = output<void>();
  readonly exportConfig = output<void>();
  readonly importEndpoints = output<void>();
  readonly editGlobalConfig = output<void>();

  protected readonly quickActions = [
    {
      id: 'create',
      title: 'Create endpoint',
      subtitle: 'Add a new mock endpoint',
      icon: 'plus' as const,
    },
    {
      id: 'test',
      title: 'Test all endpoints',
      subtitle: 'Run health check on all',
      icon: 'play' as const,
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

  protected onQuickAction(id: string): void {
    switch (id) {
      case 'create':
        this.createEndpoint.emit();
        break;
      case 'test':
        this.testAllEndpoints.emit();
        break;
      case 'export':
        this.exportConfig.emit();
        break;
      case 'import':
        this.importEndpoints.emit();
        break;
      default:
        break;
    }
  }
}
