import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideDownload, LucidePlay, LucidePlus, LucideSparkles, LucideSettings, LucideUpload } from '@lucide/angular';

import type { DashboardProject } from '../../models/dashboard-project.model';

interface UtilityQuickAction {
  id: 'create' | 'create-manual' | 'snapshot' | 'test' | 'export' | 'import';
  title: string;
  subtitle: string;
  icon: 'plus' | 'play' | 'download' | 'upload' | 'sparkles';
  featured?: boolean;
  disabled?: boolean;
}

@Component({
  selector: 'app-main-dashboard-utility-sidebar',
  templateUrl: './main-dashboard-utility-sidebar.component.html',
  styleUrls: ['./main-dashboard-utility-sidebar.component.css'],
  standalone: true,
  imports: [LucideDownload, LucidePlay, LucidePlus, LucideSparkles, LucideSettings, LucideUpload],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDashboardUtilitySidebarComponent {
  readonly project = input.required<DashboardProject>();
  readonly canMutate = input(true);

  readonly createEndpoint = output<void>();
  readonly createManualEndpoint = output<void>();
  readonly createSnapshot = output<void>();
  readonly testAllEndpoints = output<void>();
  readonly exportConfig = output<void>();
  readonly importEndpoints = output<void>();
  readonly editGlobalConfig = output<void>();

  protected readonly quickActions: UtilityQuickAction[] = [
    {
      id: 'create',
      title: 'Create endpoint with AI',
      subtitle: 'Add a new mock endpoint',
      icon: 'sparkles' as const,
      featured: true,
    },
    {
      id: 'create-manual',
      title: 'Create endpoint',
      subtitle: 'Configure and define your endpoint manually',
      icon: 'plus' as const,
    },
    {
      id: 'snapshot',
      title: 'Create snapshot',
      subtitle: 'Save the current project state',
      icon: 'download' as const,
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
      title: 'Export contract',
      subtitle: 'Download backend OpenAPI JSON or YAML',
      icon: 'download' as const,
    },
    {
      id: 'import',
      title: 'Import contract',
      subtitle: 'Analyze an OpenAPI file before commit',
      icon: 'upload' as const,
    },
  ];

  protected readonly globalConfigRows = computed(() => {
    const config = this.project().configSummary;
    let defaultLatencyBadge = 'Disabled';
    if (config.latency.enabled) {
      defaultLatencyBadge =
        config.latency.mode === 'range'
          ? `${config.latency.minMs}–${config.latency.maxMs}ms`
          : `${config.latency.maxMs}ms`;
    }
    let loggingBadge: 'Full' | 'Off' | 'Basic' = 'Basic';
    if (config.logging.level === 'full') {
      loggingBadge = 'Full';
    } else if (config.logging.level === 'off') {
      loggingBadge = 'Off';
    }

    return [
      {
        label: 'Default latency',
        badge: defaultLatencyBadge,
        tone: 'neutral' as const,
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
        badge: loggingBadge,
        tone: 'neutral' as const,
      },
    ];
  });

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
      case 'create-manual':
        if (!this.canMutate()) return;
        this.createManualEndpoint.emit();
        break;
      case 'snapshot':
        if (!this.canMutate()) return;
        this.createSnapshot.emit();
        break;
      case 'test':
        this.testAllEndpoints.emit();
        break;
      case 'export':
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
