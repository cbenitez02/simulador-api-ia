import { authorizeProjectAccess } from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import type { ListProjectLogsQuery } from './schema.js';

export interface ApiLogCursor {
  createdAt: string;
  id: string;
}

export interface ProjectLogItem {
  id: string;
  projectId: string;
  method: string;
  path: string;
  fullUrl: string;
  origin: string;
  statusCode: number;
  latencyMs: number;
  scenarioType: string;
  scenarioSelectionSource: string;
  scenarioName: string | null;
  hasScenario: boolean;
  requestHeaders: unknown;
  requestBody: unknown;
  responseHeaders: unknown;
  responseBody: unknown;
  createdAt: string;
}

export interface ProjectLogListResult {
  items: ProjectLogItem[];
  nextCursor: ApiLogCursor | null;
  serverTime: string;
}

function buildCursorFilter(query: ListProjectLogsQuery) {
  if (!query.cursorCreatedAt || !query.cursorId) {
    return { OR: undefined };
  }

  const cursorDate = new Date(query.cursorCreatedAt);

  return {
    OR: [
      { createdAt: { gt: cursorDate } },
      {
        createdAt: cursorDate,
        id: { gt: query.cursorId },
      },
    ],
  };
}

function toCursor(log: { createdAt: Date; id: string } | null): ApiLogCursor | null {
  if (!log) {
    return null;
  }

  return {
    createdAt: log.createdAt.toISOString(),
    id: log.id,
  };
}

function toProjectLogItem(log: {
  id: string;
  projectId: string;
  method: string;
  path: string;
  fullUrl: string;
  origin: string;
  statusCode: number;
  latencyMs: number;
  scenarioType: string;
  scenarioSelectionSource: string;
  scenarioName: string | null;
  requestHeaders: unknown;
  requestBody: unknown;
  responseHeaders: unknown;
  responseBody: unknown;
  createdAt: Date;
}): ProjectLogItem {
  return {
    id: log.id,
    projectId: log.projectId,
    method: log.method,
    path: log.path,
    fullUrl: log.fullUrl,
    origin: log.origin,
    statusCode: log.statusCode,
    latencyMs: log.latencyMs,
    scenarioType: log.scenarioType,
    scenarioSelectionSource: log.scenarioSelectionSource,
    scenarioName: log.scenarioName,
    hasScenario: log.scenarioName !== null,
    requestHeaders: log.requestHeaders,
    requestBody: log.requestBody,
    responseHeaders: log.responseHeaders,
    responseBody: log.responseBody,
    createdAt: log.createdAt.toISOString(),
  };
}

export async function listProjectLogs(
  actor: AuthenticatedActor,
  projectId: string,
  query: ListProjectLogsQuery
): Promise<ProjectLogListResult> {
  await authorizeProjectAccess(actor, projectId);

  const cursorFilter = buildCursorFilter(query);

  const items = await prisma.apiLog.findMany({
    where: {
      projectId,
      ...(cursorFilter.OR ? { OR: cursorFilter.OR } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit,
  });

  return {
    items: items.map(toProjectLogItem),
    nextCursor: toCursor(items[0] ?? null),
    serverTime: new Date().toISOString(),
  };
}

export async function clearProjectLogs(
  actor: AuthenticatedActor,
  projectId: string
): Promise<void> {
  await authorizeProjectAccess(actor, projectId);

  await prisma.apiLog.deleteMany({
    where: { projectId },
  });
}
