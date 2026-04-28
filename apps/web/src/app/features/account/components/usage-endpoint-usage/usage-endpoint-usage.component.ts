import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideTrendingDown, LucideTrendingUp } from '@lucide/angular';

import type { UsageEndpointUsageRow } from './usage-endpoint-usage.mock';
import { USAGE_ENDPOINT_USAGE_MOCK } from './usage-endpoint-usage.mock';

@Component({
  selector: 'app-usage-endpoint-usage',
  standalone: true,
  imports: [LucideTrendingDown, LucideTrendingUp],
  templateUrl: './usage-endpoint-usage.component.html',
  styleUrls: ['./usage-endpoint-usage.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageEndpointUsageComponent {
  /** Filas; por defecto mock hasta exista API. */
  readonly rows = input<readonly UsageEndpointUsageRow[]>(USAGE_ENDPOINT_USAGE_MOCK);

  private readonly numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  private readonly pctFmt = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  protected formatRequests(n: number): string {
    return this.numberFmt.format(n);
  }

  protected formatLatency(ms: number): string {
    return `${this.numberFmt.format(ms)}ms`;
  }

  protected formatErrorPct(pct: number): string {
    return `${this.pctFmt.format(pct)}%`;
  }

  protected formatTrendSigned(direction: 'up' | 'down', pct: number): string {
    const sign = direction === 'up' ? '+' : '-';
    return `${sign}${this.numberFmt.format(pct)}%`;
  }

  protected errorTier(pct: number): 'low' | 'medium' | 'high' {
    if (pct < 1.5) return 'low';
    if (pct <= 3) return 'medium';
    return 'high';
  }
}
