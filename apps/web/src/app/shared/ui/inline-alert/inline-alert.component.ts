import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-inline-alert',
  standalone: true,
  templateUrl: './inline-alert.component.html',
  styleUrls: ['./inline-alert.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineAlertComponent {
  readonly message = input<string | null>(null);
  /** Tighter vertical margins for stacked form fields */
  readonly tight = input(false);
}
