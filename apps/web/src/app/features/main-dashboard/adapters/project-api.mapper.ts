import type { DashboardProject } from '../models/dashboard-project.model';
import type { EndpointPreview } from '../../../shared/models/endpoint-preview.model';
import type { EndpointDto, ProjectDto } from '../../../shared/http/api.types';
import { formatRelativeTime } from '../../../shared/utils/relative-time';
import { mapEndpointSummaryFromApi } from '../../endpoints/adapters/endpoint-api.mapper';

const MOCK_BASE_URL = 'http://localhost:3000/mock';

export function mapDashboardProjectFromApi(project: ProjectDto, endpoints: EndpointDto[] = []): DashboardProject {
  return {
    id: project.id,
    name: project.name,
    mockUrl: `${MOCK_BASE_URL}/${project.slug}`,
    description: project.description || 'Your mock API workspace.',
    lastUpdatedRelative: formatRelativeTime(project.updatedAt),
    endpoints: endpoints.map(mapEndpointSummaryFromApi),
  };
}

export function mapCreatedProjectPlaceholder(project: ProjectDto): DashboardProject {
  return mapDashboardProjectFromApi(project, []);
}

export function replaceProjectEndpoints(project: DashboardProject, endpoints: EndpointPreview[]): DashboardProject {
  return { ...project, endpoints };
}
