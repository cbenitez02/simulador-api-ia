import type { DashboardProject } from '../../features/main-dashboard/models/dashboard-project.model';
import type { EndpointPreview } from './endpoint-preview.model';
import type { MockScenarioId } from './mock-scenario.model';
import type { EndpointConfig } from './endpoint-config.model';

/** App-level project aggregate (dashboard + workspace). */
export type Project = DashboardProject;
/** Mock endpoint definition shown in lists and detail. */
export type Endpoint = EndpointPreview;
/** Scenario identifier for mock behavior toggles. */
export type Scenario = MockScenarioId;

export type { EndpointConfig };
