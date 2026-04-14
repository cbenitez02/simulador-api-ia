import type { HttpMethod } from '../../../../shared/models/endpoint-preview.model';
import type { SelectMenuOption } from '../../../../shared/ui/select-menu/select-menu.component';

export type EndpointsListMethodFilter = 'all' | HttpMethod;
export type EndpointsListSortOption = 'path-asc' | 'path-desc' | 'method';

export const ENDPOINTS_LIST_METHOD_FILTER_OPTIONS: readonly SelectMenuOption[] = [
  { value: 'all', label: 'All methods' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
];

export const ENDPOINTS_LIST_SORT_OPTIONS: readonly SelectMenuOption[] = [
  { value: 'path-asc', label: 'Path (A–Z)' },
  { value: 'path-desc', label: 'Path (Z–A)' },
  { value: 'method', label: 'Method' },
];
