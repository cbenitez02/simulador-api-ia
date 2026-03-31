import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  LucideAlertCircle,
  LucideAlertTriangle,
  LucideCircle,
  LucideCircleCheck,
  LucideClock,
  LucideCopy,
  LucideFileText,
} from '@lucide/angular';
import { HttpMethodBadgeComponent } from '../../../../shared/ui/http-method-badge/http-method-badge.component';
import type { DashboardProject } from '../../models/dashboard-project.model';
import type { EndpointPreview } from '../../../../shared/models/endpoint-preview.model';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDashboardDataComponent {
  readonly project = input.required<DashboardProject>();

  readonly openLogs = output<void>();
  readonly createEndpoint = output<void>();

  protected readonly endpointCount = computed(() => this.project().endpoints.length);

  protected readonly scenarioCount = computed(() => {
    const n = this.endpointCount();
    return n <= 0 ? 0 : n * 2 + 1;
  });

  protected readonly avgLatencyMs = computed(() => {
    const eps = this.project().endpoints;
    if (eps.length === 0) return 0;
    const sum = eps.reduce((s, e) => s + e.latencyMs, 0);
    return Math.round(sum / eps.length);
  });

  protected readonly errorRatePct = computed(() => {
    const n = this.endpointCount();
    if (n === 0) return 0;
    return 5 + (n % 6);
  });

  protected readonly health = computed(() => {
    const n = this.endpointCount();
    return {
      ready: n === 0 ? 0 : Math.max(1, n - 1),
      missingScenarios: n > 0 ? 1 : 0,
      errorSim: Math.min(2, Math.max(0, n - 1)),
      emptyState: n >= 3 ? 1 : 0,
      timeouts: 0,
    };
  });

  protected readonly endpointRows = computed((): EndpointTableRow[] =>
    this.project().endpoints.map((ep, i) => ({
      endpoint: ep,
      scenarios: 2 + (i % 2),
      latencyMs: ep.latencyMs,
      errorLabel: i === 1 ? '5%' : '0%',
    })),
  );

  protected copyProjectUrl(): void {
    const url = this.project().mockUrl;
    void navigator.clipboard.writeText(url);
  }
}

interface EndpointTableRow {
  endpoint: EndpointPreview;
  scenarios: number;
  latencyMs: number;
  errorLabel: string;
}
