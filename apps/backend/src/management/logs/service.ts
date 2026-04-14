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

  if (query.direction === 'older') {
    return {
      OR: [
        { createdAt: { lt: cursorDate } },
        {
          createdAt: cursorDate,
          id: { lt: query.cursorId },
        },
      ],
    };
  }

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

function buildStatusFilter(query: ListProjectLogsQuery) {
  switch (query.statusBucket) {
    case '2xx':
      return { gte: 200, lt: 300 };
    case '3xx':
      return { gte: 300, lt: 400 };
    case '4xx':
      return { gte: 400, lt: 500 };
    case '5xx':
      return { gte: 500, lt: 600 };
    default:
      return undefined;
  }
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
  const statusFilter = buildStatusFilter(query);

  const items = await prisma.apiLog.findMany({
    where: {
      projectId,
      ...(query.method ? { method: query.method } : {}),
      ...(query.path ? { path: { contains: query.path, mode: 'insensitive' as const } } : {}),
      ...(statusFilter ? { statusCode: statusFilter } : {}),
      ...(cursorFilter.OR ? { OR: cursorFilter.OR } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit,
  });

  const cursorItem = query.direction === 'newer' ? (items[0] ?? null) : (items.at(-1) ?? null);

  return {
    items: items.map(toProjectLogItem),
    nextCursor: toCursor(cursorItem),
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
