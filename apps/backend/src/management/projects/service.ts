import {
  getAccessibleWorkspaceIds,
  authorizeProjectAccess,
  requireWorkspaceAccess,
  resolveDefaultWorkspaceId,
} from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { buildBaseSlug, resolveNextAvailableSlug } from './slug.js';
import type { CreateProjectInput, UpdateProjectInput } from './schema.js';

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

export async function listProjects(actor: AuthenticatedActor) {
  return prisma.project.findMany({
    where: {
      workspaceId: {
        in: getAccessibleWorkspaceIds(actor),
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { endpoints: true },
      },
    },
  });
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

  return project;
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

    return tx.project.findUniqueOrThrow({
      where: { id: createdProject.id },
      include: {
        globalConfig: true,
        _count: {
          select: { endpoints: true },
        },
      },
    });
  });
}

export async function updateProject(
  actor: AuthenticatedActor,
  projectId: string,
  input: UpdateProjectInput
) {
  await authorizeProjectAccess(actor, projectId);

  return prisma.project.update({
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
}

export async function deleteProject(actor: AuthenticatedActor, projectId: string): Promise<void> {
  await authorizeProjectAccess(actor, projectId);

  await prisma.project.delete({ where: { id: projectId } });
}
