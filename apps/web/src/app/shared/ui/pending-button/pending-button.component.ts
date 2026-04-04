import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideLoader2 } from '@lucide/angular';

@Component({
  selector: 'app-pending-button',
  standalone: true,
  templateUrl: './pending-button.component.html',
  styleUrls: ['./pending-button.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideLoader2],
  host: {
    '[class.cp-pending-button-host--full]': 'fullWidth()',
  },
})
export class PendingButtonComponent {
  readonly pending = input(false);
  readonly disabled = input(false);
  readonly label = input.required<string>();
  readonly pendingLabel = input.required<string>();
  readonly fullWidth = input(false);
  readonly type = input<'button' | 'submit'>('button');

  readonly clicked = output<void>();

  protected onClick(): void {
    if (this.pending() || this.disabled()) return;
    this.clicked.emit();
  }
}
