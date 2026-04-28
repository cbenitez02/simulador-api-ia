import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import {
  LucideAlertCircle,
  LucideAlertTriangle,
  LucideCircle,
  LucideCircleCheck,
  LucideCheck,
  LucideClock,
  LucideCopy,
  LucideLayers,
  LucidePencil,
  LucidePlus,
  LucideRoute,
  LucideTrash2,
} from '@lucide/angular';
import { HttpMethodBadgeComponent } from '../../../../shared/ui/http-method-badge/http-method-badge.component';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
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
    LucideCheck,
    LucideClock,
    LucideCopy,
    LucideLayers,
    LucidePencil,
    LucidePlus,
    LucideRoute,
    LucideTrash2,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDashboardDataComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  readonly project = input.required<DashboardProject>();
  readonly canMutate = input(true);

  readonly openLogs = output<void>();
  readonly openEndpoints = output<void>();
  readonly createEndpoint = output<void>();
  readonly editProjectRequested = output<void>();
  readonly deleteProjectRequested = output<void>();

  protected readonly metrics = computed(() => this.project().metrics);
  protected readonly health = computed(() => this.project().health);
  protected readonly endpointRows = computed(() => this.project().endpointRows);
  protected readonly endpointRowsMeta = computed(() => this.project().endpointRowsMeta);
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
    this.copyBaseUrlState.set(ok ? 'copied' : 'idle');

    if (ok) {
      this.toast.success('Ruta del mock copiada', { description: url });
    } else {
      this.toast.error('No se pudo copiar la ruta');
    }

    this.copyBaseUrlResetHandle = setTimeout(() => {
      this.copyBaseUrlState.set('idle');
      this.copyBaseUrlResetHandle = null;
    }, 1500);
  }
}
