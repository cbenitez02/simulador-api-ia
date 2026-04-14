import {
  getAccessibleWorkspaceIds,
  authorizeProjectAccess,
  requireWorkspaceAccess,
  resolveWorkspaceAccess,
  resolveDefaultWorkspaceId,
} from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { buildBaseSlug, resolveNextAvailableSlug } from './slug.js';
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
      workspace: resolveWorkspaceAccess(actor, project.workspaceId),
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
        select: { id: true },
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
    workspace: resolveWorkspaceAccess(actor, project.workspaceId),
  };
}

export async function createProject(actor: AuthenticatedActor, input: CreateProjectInput) {
  const slug = await generateUniqueProjectSlug(input.name);
  const workspaceId = resolveDefaultWorkspaceId(actor);

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

    const project = await tx.project.findUniqueOrThrow({
      where: { id: createdProject.id },
      include: {
        globalConfig: true,
        _count: {
          select: { endpoints: true },
        },
      },
    });

    return {
      ...project,
      workspace: resolveWorkspaceAccess(actor, project.workspaceId),
    };
  });
}

export async function updateProject(
  actor: AuthenticatedActor,
  projectId: string,
  input: UpdateProjectInput
) {
  await authorizeProjectAccess(actor, projectId, 'mutate');

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
    include: {
      globalConfig: true,
      _count: {
        select: { endpoints: true },
      },
    },
  });

  return {
    ...project,
    workspace: resolveWorkspaceAccess(actor, project.workspaceId),
  };
}

export async function deleteProject(actor: AuthenticatedActor, projectId: string): Promise<void> {
  await authorizeProjectAccess(actor, projectId, 'mutate');

  await prisma.project.delete({ where: { id: projectId } });
}
