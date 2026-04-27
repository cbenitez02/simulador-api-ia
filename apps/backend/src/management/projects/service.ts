import {
  getAccessibleWorkspaceIds,
  authorizeProjectAccess,
  requireWorkspaceAccess,
  summarizeWorkspaceAccess,
  resolveDefaultWorkspaceId,
} from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { writeAuditEvent } from '../audit-events/service.js';
import { buildBaseSlug, isReservedSlug, resolveNextAvailableSlug } from './slug.js';
import type { CreateProjectInput, ListProjectsQueryInput, UpdateProjectInput } from './schema.js';

type PagedResult<T> = {
  items: T[];
  page: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

async function generateUniqueProjectSlug(name: string): Promise<string> {
  const baseSlug = buildBaseSlug(name);

  const existing = await prisma.project.findMany({
    where: {
      OR: [{ slug: baseSlug }, { slug: { startsWith: `${baseSlug}-` } }],
    },
    select: { slug: true },
  });

  return resolveNextAvailableSlug(
    baseSlug,
    existing.map((project) => project.slug)
  );
}

export async function listProjects(
  actor: AuthenticatedActor,
  query: ListProjectsQueryInput
): Promise<PagedResult<Awaited<ReturnType<typeof prisma.project.findMany>>[number]>> {
  const where = {
    workspaceId: {
      in: getAccessibleWorkspaceIds(actor),
    },
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' as const } },
            { slug: { contains: query.q, mode: 'insensitive' as const } },
            { description: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: query.offset,
      take: query.limit,
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            kind: true,
          },
        },
        _count: {
          select: { endpoints: true },
        },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return {
    items: items.map((project) => ({
      ...project,
      workspace: summarizeWorkspaceAccess(actor, project.workspace ?? project.workspaceId),
    })),
    page: {
      limit: query.limit,
      offset: query.offset,
      total,
      hasMore: query.offset + items.length < total,
    },
  };
}

export async function getProjectById(actor: AuthenticatedActor, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workspace: {
        select: { id: true, name: true, kind: true },
      },
      globalConfig: true,
      _count: {
        select: { endpoints: true },
      },
    },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  requireWorkspaceAccess(actor, project.workspaceId);

  return {
    ...project,
    workspace: summarizeWorkspaceAccess(actor, project.workspace ?? project.workspaceId),
  };
}

export async function createProject(actor: AuthenticatedActor, input: CreateProjectInput) {
  const workspaceId = input.workspaceId
    ? requireWorkspaceAccess(actor, input.workspaceId, 'mutate')
    : resolveDefaultWorkspaceId(actor);
  const slug = await generateUniqueProjectSlug(input.name);

  return prisma.$transaction(async (tx) => {
    const createdProject = await tx.project.create({
      data: {
        workspaceId,
        name: input.name,
        slug,
        description: input.description ?? '',
      },
    });

    await tx.globalConfig.create({
      data: {
        projectId: createdProject.id,
      },
    });

    await writeAuditEvent(tx, {
      actor,
      workspaceId,
      projectId: createdProject.id,
      resourceType: 'project',
      resourceId: createdProject.id,
      action: 'created',
      summary: `Created project ${createdProject.name}`,
      metadata: {
        projectName: createdProject.name,
        projectSlug: createdProject.slug,
      },
    });

    const project = await tx.project.findUniqueOrThrow({
      where: { id: createdProject.id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            kind: true,
          },
        },
        globalConfig: true,
        _count: {
          select: { endpoints: true },
        },
      },
    });

    return {
      ...project,
      workspace: summarizeWorkspaceAccess(
        actor,
        project.workspace ?? project.workspaceId,
        'mutate'
      ),
    };
  });
}

export async function updateProject(
  actor: AuthenticatedActor,
  projectId: string,
  input: UpdateProjectInput
) {
  const authorizedProject = await authorizeProjectAccess(actor, projectId, 'mutate');
  const requestedWorkspaceId = input.workspaceId?.trim();
  const transferWorkspaceId =
    requestedWorkspaceId && requestedWorkspaceId !== authorizedProject.workspaceId
      ? requireWorkspaceAccess(actor, requestedWorkspaceId, 'mutate')
      : undefined;

  const project = await prisma.$transaction(async (tx) => {
    const currentProject = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        id: true,
        slug: true,
        workspaceId: true,
        workspace: {
          select: {
            id: true,
            name: true,
            kind: true,
          },
        },
      },
    });
    const normalizedSlug = input.slug === undefined ? undefined : buildBaseSlug(input.slug);

    if (normalizedSlug !== undefined) {
      if (isReservedSlug(normalizedSlug)) {
        throw new AppError(409, 'Project slug is reserved', {
          code: 'PROJECT_SLUG_RESERVED',
        });
      }

      const slugOwner = await tx.project.findUnique({
        where: { slug: normalizedSlug },
        select: { id: true },
      });

      if (slugOwner && slugOwner.id !== projectId) {
        throw new AppError(409, 'Project slug already exists', {
          code: 'PROJECT_SLUG_DUPLICATE',
        });
      }
    }

    const updatedProject = await tx.project.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(normalizedSlug !== undefined ? { slug: normalizedSlug } : {}),
        ...(transferWorkspaceId !== undefined ? { workspaceId: transferWorkspaceId } : {}),
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            kind: true,
          },
        },
        globalConfig: true,
        _count: {
          select: { endpoints: true },
        },
      },
    });

    await writeAuditEvent(tx, {
      actor,
      workspaceId: updatedProject.workspaceId ?? '',
      projectId: updatedProject.id,
      resourceType: 'project',
      resourceId: updatedProject.id,
      action: 'updated',
      summary: `Updated project ${updatedProject.name}`,
      metadata: {
        projectName: updatedProject.name,
        ...(normalizedSlug !== undefined && normalizedSlug !== currentProject.slug
          ? {
              previousProjectSlug: currentProject.slug,
              projectSlug: updatedProject.slug,
            }
          : {}),
        ...(transferWorkspaceId !== undefined
          ? {
              previousWorkspaceId: currentProject.workspaceId,
              previousWorkspaceName: currentProject.workspace?.name ?? currentProject.workspaceId,
              nextWorkspaceId: updatedProject.workspaceId,
              nextWorkspaceName: updatedProject.workspace?.name ?? updatedProject.workspaceId,
            }
          : {}),
      },
    });

    return updatedProject;
  });

  return {
    ...project,
    workspace: summarizeWorkspaceAccess(actor, project.workspace ?? project.workspaceId),
  };
}

export async function deleteProject(actor: AuthenticatedActor, projectId: string): Promise<void> {
  const authorizedProject = await authorizeProjectAccess(actor, projectId, 'mutate');

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
      },
    });

    await writeAuditEvent(tx, {
      actor,
      workspaceId: authorizedProject.workspaceId ?? '',
      projectId: project.id,
      resourceType: 'project',
      resourceId: project.id,
      action: 'deleted',
      summary: `Deleted project ${project.name}`,
      metadata: {
        projectName: project.name,
      },
    });

    await tx.project.delete({ where: { id: projectId } });
  });
}
