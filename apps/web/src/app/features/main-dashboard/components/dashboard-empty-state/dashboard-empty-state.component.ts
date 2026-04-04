import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { LucideArrowRight, LucidePlay, LucidePlus, LucideSparkles } from '@lucide/angular';

@Component({
  selector: 'app-dashboard-empty-state',
  standalone: true,
  imports: [LucideArrowRight, LucidePlay, LucidePlus, LucideSparkles],
  templateUrl: './dashboard-empty-state.component.html',
  styleUrls: ['./dashboard-empty-state.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardEmptyStateComponent {
  readonly createFirstProject = output<void>();
  readonly tryDemoProject = output<void>();
  readonly generateDemoFromCard = output<void>();
}
