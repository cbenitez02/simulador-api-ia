import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { EndpointPreview } from '../../shared/models/endpoint-preview.model';
import { EndpointsListComponent } from './components/endpoints-list/endpoints-list.component';

@Component({
  selector: 'app-endpoints-page',
  standalone: true,
  imports: [EndpointsListComponent],
  templateUrl: './endpoints-page.component.html',
  styleUrls: ['./endpoints-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EndpointsPageComponent {
  readonly endpoints = input.required<EndpointPreview[]>();
  readonly selectedEndpointId = input<string | null>(null);

  readonly endpointSelect = output<string>();
  readonly createEndpoint = output<void>();
}
