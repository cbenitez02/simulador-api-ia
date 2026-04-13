import { prisma } from '../../lib/prisma.js';

export async function getOperationalHealth() {
  const [projectCount, endpointCount, logCount] = await Promise.all([
    prisma.project.count(),
    prisma.endpoint.count(),
    prisma.apiLog.count(),
  ]);

  return {
    ok: true,
    service: 'backend',
    timestamp: new Date().toISOString(),
    metrics: {
      projects: projectCount,
      endpoints: endpointCount,
      logs: logCount,
    },
  };
}
