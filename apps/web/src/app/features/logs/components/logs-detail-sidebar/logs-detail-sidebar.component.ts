import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import {
  LucideAlertCircle,
  LucideCircleCheck,
  LucideClock,
  LucideFileText,
  LucideMinus,
  LucideRotateCcw,
  LucideX,
} from '@lucide/angular';
import { JsonLineHighlightPipe } from '../../../../shared/pipes/json-line-highlight.pipe';
import { HttpMethodBadgeComponent } from '../../../../shared/ui/http-method-badge/http-method-badge.component';
import type { ApiLogEntry } from '../../models/api-log.model';

@Component({
  selector: 'app-logs-detail-sidebar',
  templateUrl: './logs-detail-sidebar.component.html',
  styleUrls: ['./logs-detail-sidebar.component.css'],
  standalone: true,
  imports: [
    HttpMethodBadgeComponent,
    JsonLineHighlightPipe,
    LucideAlertCircle,
    LucideCircleCheck,
    LucideClock,
    LucideFileText,
    LucideMinus,
    LucideRotateCcw,
    LucideX,
    NgClass,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsDetailSidebarComponent {
  readonly entry = input<ApiLogEntry | null>(null);

  readonly closed = output<void>();

  protected readonly detailTab = signal<'request' | 'response'>('response');

  constructor() {
    effect(() => {
      this.entry();
      untracked(() => this.detailTab.set('response'));
    });
  }

  protected readonly responseJsonLines = computed((): string[] => {
    const ep = this.entry();
    if (!ep || ep.responseBody === null || ep.responseBody === undefined) return [];
    try {
      const text = JSON.stringify(ep.responseBody, null, 2);
      return text.split('\n');
    } catch {
      return [String(ep.responseBody)];
    }
  });

  protected readonly requestJsonLines = computed((): string[] => {
    const ep = this.entry();
    if (!ep || ep.requestBody === null || ep.requestBody === undefined) return [];
    try {
      const text = JSON.stringify(ep.requestBody, null, 2);
      return text.split('\n');
    } catch {
      return [String(ep.requestBody)];
    }
  });

  protected readonly responseHeaderRows = computed(() => {
    const ep = this.entry();
    const raw = ep?.responseHeaders ?? {};
    return Object.entries(raw).sort(([a], [b]) => a.localeCompare(b));
  });

  protected readonly requestHeaderRows = computed(() => {
    const ep = this.entry();
    const raw = ep?.requestHeaders ?? {};
    return Object.entries(raw).sort(([a], [b]) => a.localeCompare(b));
  });

  protected readonly statusBadgeClass = computed(() => {
    const code = this.entry()?.statusCode ?? 0;
    if (code >= 500) return 'detail__log-status--5xx';
    if (code >= 400) return 'detail__log-status--4xx';
    if (code >= 200 && code < 300) return 'detail__log-status--2xx';
    return 'detail__log-status--other';
  });

  protected readonly statusHeroClass = computed(() => {
    const code = this.entry()?.statusCode ?? 0;
    if (code >= 500) return 'detail__status-hero--5xx';
    if (code >= 400) return 'detail__status-hero--4xx';
    if (code >= 200 && code < 300) return 'detail__status-hero--2xx';
    return 'detail__status-hero--other';
  });

  protected selectTab(tab: 'request' | 'response'): void {
    this.detailTab.set(tab);
  }

  protected closePanel(): void {
    this.closed.emit();
  }

  protected scenarioHeroClass(scenario: NonNullable<ApiLogEntry>['scenario']): string {
    switch (scenario) {
      case 'success':
        return 'detail__scenario-hero--success';
      case 'error':
      case 'forced-error':
      case 'rate-limit-block':
      case 'timeout':
        return 'detail__scenario-hero--error';
      default:
        return 'detail__scenario-hero--empty';
    }
  }

  protected executionSummary(log: ApiLogEntry): string {
    const label = log.scenarioName ? `'${log.scenarioName}'` : `'${log.scenario}'`;
    switch (log.scenarioSelectionSource) {
      case 'weighted-random':
        return `Scenario ${label} selected from weighted probability rules.`;
      case 'uniform-random':
        return `Scenario ${label} selected from uniform random rules.`;
      case 'forced-error':
        return 'Response forced by global error simulation.';
      case 'rate-limit':
        return 'Response blocked by project-wide runtime rate limiting.';
      default:
        return log.hasScenario
          ? `Scenario ${label} selected directly from endpoint configuration.`
          : 'No scenario matched. Response came from the endpoint default payload.';
    }
  }
}
