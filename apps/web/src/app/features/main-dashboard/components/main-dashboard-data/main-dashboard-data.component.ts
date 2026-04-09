import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import {
  LucideAlertCircle,
  LucideAlertTriangle,
  LucideCircle,
  LucideCircleCheck,
  LucideClock,
  LucideCopy,
  LucideFileText,
  LucidePencil,
  LucideTrash2,
} from '@lucide/angular';
import { HttpMethodBadgeComponent } from '../../../../shared/ui/http-method-badge/http-method-badge.component';
import { copyTextToClipboard } from '../../../../shared/utils/copy-text-to-clipboard';
import type { DashboardProject } from '../../models/dashboard-project.model';

@Component({
  selector: 'app-main-dashboard-data',
  templateUrl: './main-dashboard-data.component.html',
  styleUrls: ['./main-dashboard-data.component.css'],
  standalone: true,
  imports: [
    HttpMethodBadgeComponent,
    LucideAlertCircle,
    LucideAlertTriangle,
    LucideCircle,
    LucideCircleCheck,
    LucideClock,
    LucideCopy,
    LucideFileText,
    LucidePencil,
    LucideTrash2,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDashboardDataComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly project = input.required<DashboardProject>();

  readonly openLogs = output<void>();
  readonly createEndpoint = output<void>();
  readonly editProjectRequested = output<void>();
  readonly deleteProjectRequested = output<void>();

  protected readonly metrics = computed(() => this.project().metrics);
  protected readonly health = computed(() => this.project().health);
  protected readonly endpointRows = computed(() => this.project().endpointRows);
  protected readonly projectStatusLabel = computed(() => {
    switch (this.project().status) {
      case 'empty':
        return 'Empty';
      case 'attention':
        return 'Needs attention';
      default:
        return 'Running';
    }
  });

  /** Brief UI state after attempting to copy the mock base URL. */
  protected readonly copyBaseUrlState = signal<'idle' | 'copied' | 'error'>('idle');

  private copyBaseUrlResetHandle: ReturnType<typeof setTimeout> | null = null;

  protected readonly canCopyBaseUrl = computed(() => this.project().mockUrl.trim().length > 0);

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.copyBaseUrlResetHandle !== null) clearTimeout(this.copyBaseUrlResetHandle);
    });
  }

  protected async copyProjectUrl(): Promise<void> {
    const url = this.project().mockUrl;
    if (this.copyBaseUrlResetHandle !== null) {
      clearTimeout(this.copyBaseUrlResetHandle);
      this.copyBaseUrlResetHandle = null;
    }

    const ok = await copyTextToClipboard(url);
    this.copyBaseUrlState.set(ok ? 'copied' : 'error');

    this.copyBaseUrlResetHandle = setTimeout(() => {
      this.copyBaseUrlState.set('idle');
      this.copyBaseUrlResetHandle = null;
    }, 2000);
  }
}
