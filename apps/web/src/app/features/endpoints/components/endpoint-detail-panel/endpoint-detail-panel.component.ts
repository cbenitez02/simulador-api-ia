import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import {
  LucideCircleCheck,
  LucideCirclePlay,
  LucideClock,
  LucideCopy,
  LucideLayers,
  LucidePencil,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { JsonLineHighlightPipe } from '../../../../shared/pipes/json-line-highlight.pipe';
import type { EndpointConfig } from '../../../../shared/models/endpoint-config.model';
import type { MockScenarioId } from '../../../../shared/models/mock-scenario.model';
import type { EndpointPreview } from '../../../../shared/models/endpoint-preview.model';
import { HttpMethodBadgeComponent } from '../../../../shared/ui/http-method-badge/http-method-badge.component';
import { ConfirmDialogComponent } from '../../../../shared/ui/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-endpoint-detail-panel',
  templateUrl: './endpoint-detail-panel.component.html',
  styleUrls: ['./endpoint-detail-panel.component.css'],
  standalone: true,
  imports: [
    ConfirmDialogComponent,
    HttpMethodBadgeComponent,
    JsonLineHighlightPipe,
    LucideCircleCheck,
    LucideCirclePlay,
    LucideClock,
    LucideCopy,
    LucideLayers,
    LucidePencil,
    LucideTrash2,
    LucideX,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EndpointDetailPanelComponent {
  readonly selectedEndpoint = input<EndpointPreview | null>(null);
  /** Base URL without trailing slash, e.g. https://mock.apisim.dev/v1 */
  readonly baseUrl = input<string>('');

  readonly closed = output<void>();
  readonly testEndpoint = output<void>();
  readonly editRequested = output<EndpointPreview>();
  readonly deleteRequested = output<string>();

  protected readonly detailTab = signal<'response' | 'headers'>('response');
  protected readonly deleteConfirmOpen = signal(false);

  protected readonly deleteConfirmMessage = computed(() => {
    const ep = this.selectedEndpoint();
    if (!ep) return '';
    return `Se eliminará ${ep.method} ${ep.path} de este proyecto. Esta acción no se puede deshacer.`;
  });

  constructor() {
    effect(() => {
      this.selectedEndpoint();
      untracked(() => this.detailTab.set('response'));
    });

    effect(() => {
      if (!this.selectedEndpoint()) {
        untracked(() => this.deleteConfirmOpen.set(false));
      }
    });
  }

  protected readonly fullUrl = computed(() => {
    const ep = this.selectedEndpoint();
    const base = this.baseUrl().replace(/\/$/, '');
    if (!ep || !base) return '';
    const path = ep.path.startsWith('/') ? ep.path : `/${ep.path}`;
    return `${base}${path}`;
  });

  protected readonly jsonLines = computed(() => {
    const ep = this.selectedEndpoint();
    if (!ep) return [] as string[];
    try {
      const text = JSON.stringify(ep.responseBody, null, 2);
      return text.split('\n');
    } catch {
      return [String(ep.responseBody)];
    }
  });

  protected readonly headerRows = computed(() => {
    const ep = this.selectedEndpoint();
    const raw = ep?.responseHeaders ?? {};
    return Object.entries(raw).sort(([a], [b]) => a.localeCompare(b));
  });

  protected selectTab(tab: 'response' | 'headers'): void {
    this.detailTab.set(tab);
  }

  protected copyFullUrl(): void {
    const url = this.fullUrl();
    if (url) void navigator.clipboard.writeText(url);
  }

  protected closePanel(): void {
    this.closed.emit();
  }

  protected onTestEndpoint(): void {
    this.testEndpoint.emit();
  }

  protected onEdit(): void {
    const ep = this.selectedEndpoint();
    if (ep) this.editRequested.emit(ep);
  }

  protected openDeleteConfirm(): void {
    if (!this.selectedEndpoint()) return;
    this.deleteConfirmOpen.set(true);
  }

  protected closeDeleteConfirm(): void {
    this.deleteConfirmOpen.set(false);
  }

  protected confirmDelete(): void {
    const ep = this.selectedEndpoint();
    this.deleteConfirmOpen.set(false);
    if (!ep) return;
    this.deleteRequested.emit(ep.id);
  }

  protected scenarioChips(config: EndpointConfig): { key: MockScenarioId; label: string }[] {
    const order: MockScenarioId[] = ['success', 'empty', 'error', 'timeout'];
    const labels: Record<MockScenarioId, string> = {
      success: 'Success',
      empty: 'Empty',
      error: 'Error',
      timeout: 'Timeout',
    };
    return order.filter((k) => config.scenarios[k]).map((k) => ({ key: k, label: labels[k] }));
  }
}
