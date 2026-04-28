import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { LucideSparkles } from '@lucide/angular';

/** Mock: alinear con cuotas Usage; sustituir por API cuando exista. */
const MOCK = {
  title: 'AI Generations',
  subtitle: 'Current billing period',
  used: 24,
  limit: 50,
  tokensConsumed: 15240,
  lastActivityLabel: '2 hours ago',
} as const;

const NUM = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

@Component({
  selector: 'app-usage-ai-side-card',
  standalone: true,
  imports: [LucideSparkles],
  templateUrl: './usage-ai-side-card.component.html',
  styleUrls: ['./usage-ai-side-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageAiSideCardComponent {
  /** Mock de fila AI en Usage; cablear a datos reales si se unifica el modelo. */
  protected readonly copy = MOCK;

  protected readonly usedFormatted = NUM.format(MOCK.used);
  protected readonly limitFormatted = NUM.format(MOCK.limit);
  protected readonly tokensFormatted = NUM.format(MOCK.tokensConsumed);

  protected readonly pct = MOCK.limit <= 0 ? 0 : Math.min(100, Math.round((MOCK.used / MOCK.limit) * 1000) / 10);

  readonly viewHistoryRequested = output<void>();

  protected onViewHistory(): void {
    this.viewHistoryRequested.emit();
  }
}
