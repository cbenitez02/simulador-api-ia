import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { EndpointPreview } from '../../../../shared/models/endpoint-preview.model';
import { HttpMethodBadgeComponent } from '../../../../shared/ui/http-method-badge/http-method-badge.component';
import { SelectMenuComponent } from '../../../../shared/ui/select-menu/select-menu.component';
import {
  ENDPOINTS_LIST_METHOD_FILTER_OPTIONS,
  ENDPOINTS_LIST_METHOD_ORDER,
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

  readonly endpointSelect = output<string>();
  readonly createEndpointRequest = output<void>();

  protected readonly searchQuery = signal('');
  protected readonly methodFilter = signal<EndpointsListMethodFilter>('all');
  protected readonly sortOption = signal<EndpointsListSortOption>('path-asc');

  protected readonly filteredEndpoints = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    let list = [...this.endpoints()];

    if (q) {
      list = list.filter(
        (e) =>
          e.path.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.method.toLowerCase().includes(q),
      );
    }

    const m = this.methodFilter();
    if (m !== 'all') {
      list = list.filter((e) => e.method === m);
    }

    const sort = this.sortOption();
    list.sort((a, b) => {
      switch (sort) {
        case 'path-asc':
          return a.path.localeCompare(b.path);
        case 'path-desc':
          return b.path.localeCompare(a.path);
        case 'method':
          return (
            ENDPOINTS_LIST_METHOD_ORDER[a.method] - ENDPOINTS_LIST_METHOD_ORDER[b.method] ||
            a.path.localeCompare(b.path)
          );
        case 'latency':
          return a.latencyMs - b.latencyMs || a.path.localeCompare(b.path);
        default:
          return 0;
      }
    });

    return list;
  });

  protected onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  protected selectMethod(value: string): void {
    this.methodFilter.set(value as EndpointsListMethodFilter);
  }

  protected selectSort(value: string): void {
    this.sortOption.set(value as EndpointsListSortOption);
  }

  protected pickEndpoint(id: string): void {
    this.endpointSelect.emit(id);
  }

  protected requestCreateEndpoint(): void {
    this.createEndpointRequest.emit();
  }
}
