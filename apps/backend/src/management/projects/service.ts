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

export async function listProjects() {
  return prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { endpoints: true },
      },
    },
  });
}

export async function getProjectById(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      globalConfig: true,
      _count: {
        select: { endpoints: true },
      },
    },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  return project;
}

export async function createProject(input: CreateProjectInput) {
  const slug = await generateUniqueProjectSlug(input.name);

  return prisma.$transaction(async (tx) => {
    const createdProject = await tx.project.create({
      data: {
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

export async function updateProject(projectId: string, input: UpdateProjectInput) {
  const existingProject = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!existingProject) {
    throw new AppError(404, 'Project not found');
  }

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

export async function deleteProject(projectId: string): Promise<void> {
  const existingProject = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!existingProject) {
    throw new AppError(404, 'Project not found');
  }

  await prisma.project.delete({ where: { id: projectId } });
}
