import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  LucideArrowUpDown,
  LucideBarChart3,
  LucideFolder,
  LucideSparkles,
  LucideTrendingDown,
  LucideTrendingUp,
} from '@lucide/angular';

import type { UsageQuotaBarFill, UsageQuotaCardIcon, UsageQuotaTrendSnapshot } from './usage-quota-card.model';

/**
 * Tarjeta de cuota (uso / límite, barra, tendencia opcional).
 * Presentación genérica; los datos vienen del padre (p. ej. filas mock de Usage).
 */
@Component({
  selector: 'app-usage-quota-card',
  standalone: true,
  imports: [LucideArrowUpDown, LucideBarChart3, LucideFolder, LucideSparkles, LucideTrendingDown, LucideTrendingUp],
  templateUrl: './usage-quota-card.component.html',
  styleUrls: ['./usage-quota-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageQuotaCardComponent {
  readonly label = input.required<string>();
  readonly usedFormatted = input.required<string>();
  readonly limitFormatted = input.required<string>();
  readonly used = input.required<number>();
  readonly limit = input.required<number>();
  readonly pct = input.required<number>();
  readonly barFill = input.required<UsageQuotaBarFill>();
  readonly icon = input.required<UsageQuotaCardIcon>();
  readonly trend = input<UsageQuotaTrendSnapshot | undefined>(undefined);
}
