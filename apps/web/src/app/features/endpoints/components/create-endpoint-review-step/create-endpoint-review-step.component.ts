import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { HttpMethod } from '../../../../shared/models/endpoint-preview.model';
import { SectionHeadingComponent } from '../../../../shared/ui/section-heading/section-heading.component';
import { SelectMenuComponent, type SelectMenuOption } from '../../../../shared/ui/select-menu/select-menu.component';
import { displayRoute } from '../../../../shared/utils/display-route';
import { reviewStepCopy } from '../../../../shared/utils/endpoint-flow-ui';

@Component({
  selector: 'app-create-endpoint-review-step',
  standalone: true,
  templateUrl: './create-endpoint-review-step.component.html',
  styleUrls: ['./create-endpoint-review-step.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeadingComponent, SelectMenuComponent],
})
export class CreateEndpointReviewStepComponent {
  protected readonly displayRoute = displayRoute;
  protected readonly reviewStepCopy = reviewStepCopy;
  readonly mode = input<'ai' | 'manual'>('ai');
  readonly method = input.required<HttpMethod>();
  readonly route = input('');
  readonly methodLocked = input(false);
  readonly routeLocked = input(false);
  readonly methodOptions = input.required<readonly SelectMenuOption[]>();

  readonly methodChange = output<HttpMethod>();
  readonly routeChange = output<string>();

  protected onMethodChange(v: string): void {
    if (this.methodLocked()) return;
    this.methodChange.emit(v as HttpMethod);
  }

  protected onRouteInput(event: Event): void {
    if (this.routeLocked()) return;
    this.routeChange.emit((event.target as HTMLInputElement).value);
  }
}
