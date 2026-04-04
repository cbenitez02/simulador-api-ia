import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { HttpMethod } from '../../../../shared/models/endpoint-preview.model';
import { displayRoute } from '../../../../shared/utils/display-route';
import { SectionHeadingComponent } from '../../../../shared/ui/section-heading/section-heading.component';
import { SelectMenuComponent, type SelectMenuOption } from '../../../../shared/ui/select-menu/select-menu.component';

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
  readonly method = input.required<HttpMethod>();
  readonly route = input('');
  readonly methodOptions = input.required<readonly SelectMenuOption[]>();

  readonly methodChange = output<HttpMethod>();
  readonly routeChange = output<string>();

  protected onMethodChange(v: string): void {
    this.methodChange.emit(v as HttpMethod);
  }

  protected onRouteInput(event: Event): void {
    this.routeChange.emit((event.target as HTMLInputElement).value);
  }
}
