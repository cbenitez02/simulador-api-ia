import { describe, expect, it } from 'vitest';
import { mapProjectSnapshotDetailFromApi, mapProjectSnapshotFromApi } from './project-snapshot-api.mapper';

describe('project snapshot api mapper', () => {
  it('maps snapshot actor labels and canonical payloads for restore flows', () => {
    const snapshot = mapProjectSnapshotFromApi({
      id: 'snapshot-1',
      projectId: 'project-1',
      name: 'Before imports',
      description: 'Safe point',
      createdAt: '2026-04-17T10:00:00.000Z',
      createdBy: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User' },
    });

    const detail = mapProjectSnapshotDetailFromApi({
      id: 'snapshot-1',
      projectId: 'project-1',
      name: 'Before imports',
      description: 'Safe point',
      createdAt: '2026-04-17T10:00:00.000Z',
      createdBy: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User' },
      payload: {
        project: { id: 'project-1', slug: 'users-api', name: 'Users API', description: 'Baseline' },
        globalConfig: {
          projectId: 'project-1',
          latencyEnabled: false,
          latencyMinMs: 0,
          latencyMaxMs: 1000,
          latencyMode: 'fixed',
          errorSimulationEnabled: false,
          errorSimulationRate: 0,
          errorSimulationCodes: [500],
          rateLimitingEnabled: false,
          rateLimitingRpm: 60,
          loggingLevel: 'basic',
          scope: 'all',
        },
        endpoints: [],
      },
    });

    expect(snapshot.createdBy.label).toBe('Owner User');
    expect(detail.payload.project.name).toBe('Users API');
    expect(detail.payload.endpoints).toEqual([]);
  });
});
