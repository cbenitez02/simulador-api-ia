import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import {
  LucideAlertTriangle,
  LucideClock,
  LucideFileText,
  LucideGauge,
  LucideSlidersHorizontal,
  LucideTarget,
  LucideX,
} from '@lucide/angular';
import { SelectMenuComponent, type SelectMenuOption } from '../../../../shared/ui/select-menu/select-menu.component';
import { ToggleSwitchComponent } from '../../../../shared/ui/toggle-switch/toggle-switch.component';
import {
  GLOBAL_ERROR_STATUS_CODES,
  GLOBAL_LATENCY_MS_MAX,
  createDefaultGlobalConfig,
  isServerErrorStatusCode,
  type GlobalConfig,
  type GlobalConfigScope,
  type LatencyMode,
  type LoggingLevel,
} from '../../models/global-config.model';

@Component({
  selector: 'app-global-config-drawer',
  standalone: true,
  imports: [
    LucideAlertTriangle,
    LucideClock,
    LucideFileText,
    LucideGauge,
    LucideSlidersHorizontal,
    LucideTarget,
    LucideX,
    SelectMenuComponent,
    ToggleSwitchComponent,
  ],
  templateUrl: './global-config-drawer.component.html',
  styleUrls: ['./global-config-drawer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'gcfg-drawer-host',
  },
})
export class GlobalConfigDrawerComponent {
  readonly open = input(false);
  /** When the drawer opens, form state is reset from this value (or defaults). */
  readonly initialConfig = input<GlobalConfig | null>(null);
  readonly loading = input(false);
  readonly saving = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly closed = output<void>();
  readonly save = output<GlobalConfig>();

  protected readonly state = signal<GlobalConfig>(createDefaultGlobalConfig());

  protected readonly loggingOptions: readonly SelectMenuOption[] = [
    { value: 'none', label: 'None — Logging disabled' },
    { value: 'basic', label: 'Basic — Status and timing only' },
    { value: 'verbose', label: 'Verbose — Full details with headers & body' },
  ];

  protected readonly latencyMax = GLOBAL_LATENCY_MS_MAX;
  protected readonly statusCodes = GLOBAL_ERROR_STATUS_CODES;

  protected readonly latencyRangeLabel = computed(() => {
    const { minMs, maxMs } = this.state().latency;
    return `${minMs}ms - ${maxMs}ms`;
  });

  protected readonly dualRangeTrackStyle = computed(() => {
    const { minMs, maxMs } = this.state().latency;
    const hi = GLOBAL_LATENCY_MS_MAX;
    const p0 = (minMs / hi) * 100;
    const p1 = (maxMs / hi) * 100;
    return `linear-gradient(to right, var(--gcfg-range-muted) 0%, var(--gcfg-range-muted) ${p0}%, var(--gcfg-range-active) ${p0}%, var(--gcfg-range-active) ${p1}%, var(--gcfg-range-muted) ${p1}%, var(--gcfg-range-muted) 100%)`;
  });

  private previousOpen = false;
  private previousLoading = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const loading = this.loading();
      const init = this.initialConfig();

      if (!isOpen) {
        this.previousOpen = false;
        this.previousLoading = loading;
        return;
      }

      // On first open, `initialConfig` may still be defaults until the parent fetch finishes.
      if (!this.previousOpen) {
        this.state.set(structuredClone(init ?? createDefaultGlobalConfig()));
      } else if (this.previousLoading && !loading) {
        // Parent just finished loading — re-apply server config to the form.
        this.state.set(structuredClone(init ?? createDefaultGlobalConfig()));
      }

      this.previousOpen = isOpen;
      this.previousLoading = loading;
    });
  }

  @HostListener('document:keydown.escape')
  protected onDocumentEscape(): void {
    if (this.open()) {
      this.requestClose();
    }
  }

  protected requestClose(): void {
    if (this.saving()) return;
    this.closed.emit();
  }

  protected onSave(): void {
    if (this.loading() || this.saving()) return;
    this.save.emit(structuredClone(this.state()));
  }

  protected onBackdropClick(event: MouseEvent): void {
    const el = event.target as HTMLElement | null;
    if (el?.classList.contains('gcfg-drawer__backdrop')) {
      this.requestClose();
    }
  }

  protected setLatencyEnabled(enabled: boolean): void {
    this.state.update((s) => ({ ...s, latency: { ...s.latency, enabled } }));
  }

  protected onLatencyMinInput(raw: number): void {
    const v = Number.isFinite(raw) ? raw : 0;
    this.state.update((s) => {
      const max = s.latency.maxMs;
      return { ...s, latency: { ...s.latency, minMs: Math.min(Math.max(0, v), max) } };
    });
  }

  protected onLatencyMaxInput(raw: number): void {
    const v = Number.isFinite(raw) ? raw : 0;
    this.state.update((s) => {
      const min = s.latency.minMs;
      return {
        ...s,
        latency: { ...s.latency, maxMs: Math.max(Math.min(GLOBAL_LATENCY_MS_MAX, v), min) },
      };
    });
  }

  protected setLatencyMode(mode: LatencyMode): void {
    this.state.update((s) => ({ ...s, latency: { ...s.latency, mode } }));
  }

  protected setErrorEnabled(enabled: boolean): void {
    this.state.update((s) => ({ ...s, errorSimulation: { ...s.errorSimulation, enabled } }));
  }

  protected onErrorRateInput(raw: number): void {
    const v = Number.isFinite(raw) ? raw : 0;
    this.state.update((s) => ({
      ...s,
      errorSimulation: {
        ...s.errorSimulation,
        rate: Math.min(100, Math.max(0, Math.round(v))),
      },
    }));
  }

  protected toggleStatusCode(code: number): void {
    this.state.update((s) => {
      const set = new Set(s.errorSimulation.statusCodes);
      if (set.has(code)) {
        set.delete(code);
      } else {
        set.add(code);
      }
      return {
        ...s,
        errorSimulation: {
          ...s.errorSimulation,
          statusCodes: [...set].sort((a, b) => a - b),
        },
      };
    });
  }

  protected isStatusSelected(code: number): boolean {
    return this.state().errorSimulation.statusCodes.includes(code);
  }

  protected setRateLimitEnabled(enabled: boolean): void {
    this.state.update((s) => ({ ...s, rateLimiting: { ...s.rateLimiting, enabled } }));
  }

  protected onRpmInput(raw: string): void {
    const trimmed = raw.trim();
    if (trimmed === '') return;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 1) return;
    this.state.update((s) => ({
      ...s,
      rateLimiting: { ...s.rateLimiting, requestsPerMinute: Math.min(1_000_000, Math.floor(n)) },
    }));
  }

  protected setLoggingLevel(level: LoggingLevel): void {
    this.state.update((s) => ({ ...s, logging: { level } }));
  }

  protected onLoggingMenuChange(value: string): void {
    if (value === 'none' || value === 'basic' || value === 'verbose') {
      this.setLoggingLevel(value);
    }
  }

  protected setScope(scope: GlobalConfigScope): void {
    this.state.update((s) => ({ ...s, scope }));
  }

  protected isDangerCode(code: number): boolean {
    return isServerErrorStatusCode(code);
  }
}
