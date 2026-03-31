import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import {
  LucideClock,
  LucideDownload,
  LucideGitBranch,
  LucideLayers,
  LucidePlay,
  LucidePlus,
  LucideSettings,
  LucideUpload,
} from '@lucide/angular';

export type ActivityVerbTone = 'create' | 'add' | 'update';

export type ActivityIconKind = 'branch' | 'layers' | 'settings';

export interface UtilitySidebarActivityItem {
  id: string;
  verb: string;
  verbTone: ActivityVerbTone;
  target: string;
  timeAgo: string;
  icon: ActivityIconKind;
}

@Component({
  selector: 'app-main-dashboard-utility-sidebar',
  templateUrl: './main-dashboard-utility-sidebar.component.html',
  styleUrls: ['./main-dashboard-utility-sidebar.component.css'],
  standalone: true,
  imports: [
    LucideClock,
    LucideDownload,
    LucideGitBranch,
    LucideLayers,
    LucidePlay,
    LucidePlus,
    LucideSettings,
    LucideUpload,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDashboardUtilitySidebarComponent {
  private static readonly recentActivityLimit = 4;

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

  private static readonly activitySeed: UtilitySidebarActivityItem[] = [
    {
      id: '1',
      verb: 'created',
      verbTone: 'create',
      target: 'POST /auth/refresh',
      timeAgo: '2 hours ago',
      icon: 'branch',
    },
    {
      id: '2',
      verb: 'added',
      verbTone: 'add',
      target: '401 Unauthorized to /auth/me',
      timeAgo: '3 hours ago',
      icon: 'layers',
    },
    {
      id: '3',
      verb: 'updated',
      verbTone: 'update',
      target: 'Global latency settings',
      timeAgo: '5 hours ago',
      icon: 'settings',
    },
    {
      id: '4',
      verb: 'modified',
      verbTone: 'update',
      target: 'POST /auth/login',
      timeAgo: '1 day ago',
      icon: 'branch',
    },
    {
      id: '5',
      verb: 'added',
      verbTone: 'add',
      target: 'Rate limit to /auth/login',
      timeAgo: '1 day ago',
      icon: 'layers',
    },
  ];

  protected readonly recentActivities: UtilitySidebarActivityItem[] = [
    ...MainDashboardUtilitySidebarComponent.activitySeed.slice(
      -MainDashboardUtilitySidebarComponent.recentActivityLimit,
    ),
  ].reverse();

  protected readonly globalConfigRows = [
    { label: 'Default latency', badge: '50–200ms', tone: 'neutral' as const },
    { label: 'Error simulation', badge: 'Enabled', tone: 'success' as const },
    { label: 'Rate limiting', badge: '100 req/min', tone: 'neutral' as const },
    { label: 'Logging', badge: 'Verbose', tone: 'neutral' as const },
  ];

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
