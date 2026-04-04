import type { EndpointPreview } from '../../../shared/models/endpoint-preview.model';

export interface DashboardProject {
  id: string;
  name: string;
  mockUrl: string;
  /** Short line for dashboard hero */
  description: string;
  /** Relative time label, e.g. "2 hours ago" */
  lastUpdatedRelative: string;
  endpoints: EndpointPreview[];
}
