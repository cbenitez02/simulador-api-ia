import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';

async function assertProjectExists(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }
}

export async function listProjectLogs(projectId: string) {
  await assertProjectExists(projectId);

  return prisma.apiLog.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function clearProjectLogs(projectId: string): Promise<void> {
  await assertProjectExists(projectId);

  await prisma.apiLog.deleteMany({
    where: { projectId },
  });
}
