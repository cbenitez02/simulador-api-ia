import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-labeled-range',
  standalone: true,
  templateUrl: './labeled-range.component.html',
  styleUrls: ['./labeled-range.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabeledRangeComponent {
  readonly label = input.required<string>();
  /** Shown on the right (e.g. `1200ms`, `5%`, `0–3000ms`). */
  readonly displayValue = input.required<string>();
  readonly value = input.required<number>();
  readonly min = input(0);
  readonly max = input(100);
  readonly step = input(1);
  readonly inputId = input<string | null>(null);
  readonly disabled = input(false);

  readonly valueChange = output<number>();

  protected onInput(event: Event): void {
    const n = Number((event.target as HTMLInputElement).value);
    this.valueChange.emit(Number.isFinite(n) ? n : this.min());
  }
}
