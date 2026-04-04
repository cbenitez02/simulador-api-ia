import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { HttpMethod } from '../../models/endpoint-preview.model';

@Component({
  selector: 'app-http-method-badge',
  standalone: true,
  templateUrl: './http-method-badge.component.html',
  styleUrls: ['./http-method-badge.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HttpMethodBadgeComponent {
  readonly method = input.required<HttpMethod>();
  /** compact: list rows; emphasis: panel headers */
  readonly appearance = input<'compact' | 'emphasis'>('compact');

  protected readonly hostClass = computed(() => {
    const m = this.method().toLowerCase();
    const a = this.appearance();
    return `http-method-badge http-method-badge--${m} http-method-badge--${a}`;
  });
}
