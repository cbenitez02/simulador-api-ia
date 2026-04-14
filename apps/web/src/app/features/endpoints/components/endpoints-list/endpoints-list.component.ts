import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { EndpointPreview } from '../../../../shared/models/endpoint-preview.model';
import { HttpMethodBadgeComponent } from '../../../../shared/ui/http-method-badge/http-method-badge.component';
import { SelectMenuComponent } from '../../../../shared/ui/select-menu/select-menu.component';
import {
  ENDPOINTS_LIST_METHOD_FILTER_OPTIONS,
  ENDPOINTS_LIST_SORT_OPTIONS,
  type EndpointsListMethodFilter,
  type EndpointsListSortOption,
} from './endpoints-list.constants';

@Component({
  selector: 'app-endpoints-list',
  standalone: true,
  imports: [HttpMethodBadgeComponent, SelectMenuComponent],
  templateUrl: './endpoints-list.component.html',
  styleUrls: ['./endpoints-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EndpointsListComponent {
  protected readonly methodFilterOptions = ENDPOINTS_LIST_METHOD_FILTER_OPTIONS;
  protected readonly sortOptions = ENDPOINTS_LIST_SORT_OPTIONS;

  readonly endpoints = input.required<EndpointPreview[]>();
  readonly selectedEndpointId = input<string | null>(null);
  readonly searchQuery = input('');
  readonly methodFilter = input<EndpointsListMethodFilter>('all');
  readonly sortOption = input<EndpointsListSortOption>('path-asc');
  readonly loading = input(false);
  readonly hasMore = input(false);

  readonly endpointSelect = output<string>();
  readonly createEndpointRequest = output<void>();

  readonly searchQueryChange = output<string>();
  readonly methodFilterChange = output<EndpointsListMethodFilter>();
  readonly sortOptionChange = output<EndpointsListSortOption>();
  readonly loadMoreRequest = output<void>();

  protected onSearchInput(event: Event): void {
    this.searchQueryChange.emit((event.target as HTMLInputElement).value);
  }

  protected selectMethod(value: string): void {
    this.methodFilterChange.emit(value as EndpointsListMethodFilter);
  }

  protected selectSort(value: string): void {
    this.sortOptionChange.emit(value as EndpointsListSortOption);
  }

  protected pickEndpoint(id: string): void {
    this.endpointSelect.emit(id);
  }

  protected requestCreateEndpoint(): void {
    this.createEndpointRequest.emit();
  }

  protected requestLoadMore(): void {
    this.loadMoreRequest.emit();
  }
}
