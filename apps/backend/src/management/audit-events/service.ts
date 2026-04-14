import type { Prisma, PrismaClient } from '@prisma/client';
import { authorizeProjectAccess } from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import { toPrismaJson } from '../../lib/prisma-json.js';
import type { AuditEventAction, AuditEventResourceType, ListAuditEventsQuery } from './schema.js';

type AuditEventClient = Prisma.TransactionClient | PrismaClient;

export interface AuditEventCursor {
  createdAt: string;
  id: string;
}

export interface AuditEventItem {
  id: string;
  actor: {
    userId: string;
    email: string | null;
    displayName: string | null;
  };
  workspaceId: string;
  projectId: string;
  resourceType: AuditEventResourceType;
  resourceId: string;
  action: AuditEventAction;
  summary: string;
  metadata: unknown;
  createdAt: string;
}

export interface AuditEventListResult {
  items: AuditEventItem[];
  nextCursor: AuditEventCursor | null;
  serverTime: string;
}

export interface WriteAuditEventInput {
  actor: AuthenticatedActor;
  workspaceId: string;
  projectId: string;
  resourceType: AuditEventResourceType;
  resourceId: string;
  action: AuditEventAction;
  summary: string;
  metadata?: Record<string, unknown>;
}

function buildCursorFilter(query: ListAuditEventsQuery) {
  if (!query.cursorCreatedAt || !query.cursorId) {
    return { OR: undefined };
  }

  const cursorDate = new Date(query.cursorCreatedAt);

  if (query.direction === 'older') {
    return {
      OR: [
        { createdAt: { lt: cursorDate } },
        { createdAt: cursorDate, id: { lt: query.cursorId } },
      ],
    };
  }

  return {
    OR: [{ createdAt: { gt: cursorDate } }, { createdAt: cursorDate, id: { gt: query.cursorId } }],
  };
}

function toCursor(item: { createdAt: Date; id: string } | null): AuditEventCursor | null {
  if (!item) {
    return null;
  }

  return { createdAt: item.createdAt.toISOString(), id: item.id };
}

function toAuditEventItem(event: {
  id: string;
  actorUserId: string;
  actorEmail: string | null;
  actorDisplayName: string | null;
  workspaceId: string;
  projectId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  summary: string;
  metadata: unknown;
  createdAt: Date;
}): AuditEventItem {
  return {
    id: event.id,
    actor: {
      userId: event.actorUserId,
      email: event.actorEmail,
      displayName: event.actorDisplayName,
    },
    workspaceId: event.workspaceId,
    projectId: event.projectId,
    resourceType: event.resourceType as AuditEventResourceType,
    resourceId: event.resourceId,
    action: event.action as AuditEventAction,
    summary: event.summary,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  };
}

export async function writeAuditEvent(
  client: AuditEventClient,
  input: WriteAuditEventInput
): Promise<void> {
  const actorProfile = await client.user.findUnique({
    where: { id: input.actor.userId },
    select: { email: true, displayName: true },
  });

  await client.auditEvent.create({
    data: {
      actorUserId: input.actor.userId,
      actorEmail: actorProfile?.email ?? null,
      actorDisplayName: actorProfile?.displayName ?? null,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      action: input.action,
      summary: input.summary,
      ...(input.metadata ? { metadata: toPrismaJson(input.metadata) } : {}),
    },
  });
}

export async function listProjectAuditEvents(
  actor: AuthenticatedActor,
  projectId: string,
  query: ListAuditEventsQuery
): Promise<AuditEventListResult> {
  await authorizeProjectAccess(actor, projectId);

  const cursorFilter = buildCursorFilter(query);
  const items = await prisma.auditEvent.findMany({
    where: {
      projectId,
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(cursorFilter.OR ? { OR: cursorFilter.OR } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit,
  });

  const cursorItem = query.direction === 'newer' ? (items[0] ?? null) : (items.at(-1) ?? null);

  return {
    items: items.map(toAuditEventItem),
    nextCursor: toCursor(cursorItem),
    serverTime: new Date().toISOString(),
  };
}
