import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { LucidePlus, LucideSparkles } from '@lucide/angular';

@Component({
  selector: 'app-dashboard-empty-state',
  standalone: true,
  imports: [LucidePlus, LucideSparkles],
  templateUrl: './dashboard-empty-state.component.html',
  styleUrls: ['./dashboard-empty-state.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardEmptyStateComponent {
  readonly createFirstProject = output<void>();
}
