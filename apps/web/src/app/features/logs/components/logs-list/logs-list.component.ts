import { animate, style, transition, trigger } from '@angular/animations';
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAlertCircle, LucideCircleCheck, LucideMinus } from '@lucide/angular';
import { HttpMethodBadgeComponent } from '../../../../shared/ui/http-method-badge/http-method-badge.component';
import type { ApiLogEntry } from '../../models/api-log.model';

@Component({
  selector: 'app-logs-list',
  templateUrl: './logs-list.component.html',
  styleUrls: ['./logs-list.component.css'],
  standalone: true,
  imports: [HttpMethodBadgeComponent, LucideAlertCircle, LucideCircleCheck, LucideMinus, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('logRowEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-8px)' }),
        animate('320ms cubic-bezier(0.33, 1, 0.68, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class LogsListComponent {
  readonly entries = input.required<ApiLogEntry[]>();
  readonly selectedId = input<string | null>(null);

  readonly entrySelect = output<string>();

  protected statusClass(code: number): string {
    if (code >= 500) return 'logs-table__status--5xx';
    if (code >= 400) return 'logs-table__status--4xx';
    if (code >= 200 && code < 300) return 'logs-table__status--2xx';
    return 'logs-table__status--other';
  }

  protected scenarioClass(scenario: ApiLogEntry['scenario']): string {
    switch (scenario) {
      case 'success':
        return 'logs-table__scenario--success';
      case 'error':
        return 'logs-table__scenario--error';
      default:
        return 'logs-table__scenario--empty';
    }
  }
}
