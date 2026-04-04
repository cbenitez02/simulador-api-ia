import type { HttpMethod } from '../../../../shared/models/endpoint-preview.model';
import type { SelectMenuOption } from '../../../../shared/ui/select-menu/select-menu.component';

export type EndpointsListMethodFilter = 'all' | HttpMethod;
export type EndpointsListSortOption = 'path-asc' | 'path-desc' | 'method' | 'latency';

export const ENDPOINTS_LIST_METHOD_ORDER: Record<HttpMethod, number> = {
  GET: 0,
  POST: 1,
  PUT: 2,
  PATCH: 3,
  DELETE: 4,
};

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
  { value: 'latency', label: 'Response time' },
];
