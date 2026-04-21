import type { ApiAuditEventDto, ApiAuditEventListDto } from '../../../shared/http/api.types';
import type { AuditHistoryEntry, AuditHistoryListResult } from '../models/audit-history.model';

function timeLabel(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('en-GB', { hour12: false });
}

function resolveActorLabel(actor: ApiAuditEventDto['actor']): string {
  return actor.displayName ?? actor.email ?? actor.userId;
}

function resolveResourceLabel(event: ApiAuditEventDto): string {
  const metadata = (event.metadata ?? {}) as Record<string, unknown>;
  const endpointPath = typeof metadata['endpointPath'] === 'string' ? metadata['endpointPath'] : null;
  const method = typeof metadata['method'] === 'string' ? metadata['method'] : null;
  const projectName = typeof metadata['projectName'] === 'string' ? metadata['projectName'] : null;
  const scenarioName = typeof metadata['scenarioName'] === 'string' ? metadata['scenarioName'] : null;
  const snapshotName = typeof metadata['snapshotName'] === 'string' ? metadata['snapshotName'] : null;
  const contractName = typeof metadata['contractName'] === 'string' ? metadata['contractName'] : null;

  switch (event.resourceType) {
    case 'endpoint':
      return method && endpointPath ? `${method} ${endpointPath}` : event.resourceId;
    case 'endpoint-config':
      return method && endpointPath ? `${method} ${endpointPath} config` : 'Endpoint config';
    case 'project':
      return projectName ?? event.resourceId;
    case 'scenario':
      return scenarioName ?? event.resourceId;
    case 'global-config':
      return 'Global config';
    case 'snapshot':
      return snapshotName ?? event.resourceId;
    case 'contract':
      return contractName ?? 'OpenAPI contract';
    default:
      return event.resourceId;
  }
}

function resolveActionLabel(event: ApiAuditEventDto): string {
  if (event.resourceType === 'snapshot' && event.action === 'created') return 'saved snapshot';
  if (event.resourceType === 'snapshot' && event.action === 'restored') return 'restored snapshot';
  if (event.resourceType === 'contract' && event.action === 'analyzed') return 'analyzed contract';
  if (event.resourceType === 'contract' && event.action === 'exported') return 'exported contract';
  if (event.resourceType === 'contract' && event.action === 'imported') return 'imported contract';
  return event.action;
}

export function mapAuditEventFromApi(event: ApiAuditEventDto): AuditHistoryEntry {
  return {
    id: event.id,
    actor: event.actor,
    actorLabel: resolveActorLabel(event.actor),
    workspaceId: event.workspaceId,
    projectId: event.projectId,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    resourceLabel: resolveResourceLabel(event),
    action: event.action,
    actionLabel: resolveActionLabel(event),
    summary: event.summary,
    metadata: event.metadata,
    createdAt: event.createdAt,
    timeLabel: timeLabel(event.createdAt),
  };
}

export function mapAuditHistoryListFromApi(events: ApiAuditEventListDto): AuditHistoryListResult {
  return {
    items: events.items.map(mapAuditEventFromApi),
    nextCursor: events.nextCursor,
    serverTime: events.serverTime,
  };
}
