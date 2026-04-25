import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideSparkles } from '@lucide/angular';
import type { EndpointPreview } from '../../shared/models/endpoint-preview.model';
import { EndpointsListComponent } from './components/endpoints-list/endpoints-list.component';
import type {
  EndpointsListMethodFilter,
  EndpointsListSortOption,
} from './components/endpoints-list/endpoints-list.constants';

@Component({
  selector: 'app-endpoints-page',
  standalone: true,
  imports: [EndpointsListComponent, LucideSparkles],
  templateUrl: './endpoints-page.component.html',
  styleUrls: ['./endpoints-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EndpointsPageComponent {
  readonly endpoints = input.required<EndpointPreview[]>();
  readonly selectedEndpointId = input<string | null>(null);
  readonly searchQuery = input('');
  readonly methodFilter = input<EndpointsListMethodFilter>('all');
  readonly sortOption = input<EndpointsListSortOption>('path-asc');
  readonly loading = input(false);
  readonly hasMore = input(false);
  readonly canMutate = input(true);

  readonly endpointSelect = output<string>();
  readonly createEndpoint = output<void>();
  readonly createEndpointManual = output<void>();
  readonly searchQueryChange = output<string>();
  readonly methodFilterChange = output<EndpointsListMethodFilter>();
  readonly sortOptionChange = output<EndpointsListSortOption>();
  readonly loadMore = output<void>();

  protected onCreateEndpointRequested(source: 'header' | 'list', mode: 'ai' | 'manual' = 'ai'): void {
    if (mode === 'manual') {
      this.createEndpointManual.emit();
      return;
    }
    this.createEndpoint.emit();
  }
}
