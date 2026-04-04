import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-panel-header',
  standalone: true,
  templateUrl: './panel-header.component.html',
  styleUrls: ['./panel-header.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
}
