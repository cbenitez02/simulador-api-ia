import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type SectionHeadingVariant = 'hero' | 'card' | 'panel';

@Component({
  selector: 'app-section-heading',
  standalone: true,
  templateUrl: './section-heading.component.html',
  styleUrls: ['./section-heading.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionHeadingComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly variant = input<SectionHeadingVariant>('panel');
}
