import { describe, expect, it } from 'vitest';
import {
  mapProjectSnapshotDetailFromApi,
  mapProjectSnapshotFromApi,
  mapProjectSnapshotRestorePreviewFromApi,
} from './project-snapshot-api.mapper';

describe('project snapshot api mapper', () => {
  it('maps snapshot actor labels and canonical payloads for restore flows', () => {
    const snapshot = mapProjectSnapshotFromApi({
      id: 'snapshot-1',
      projectId: 'project-1',
      name: 'Before imports',
      description: 'Safe point',
      createdAt: '2026-04-17T10:00:00.000Z',
      createdBy: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User' },
      revision: {
        endpointCount: 2,
        scenarioCount: 4,
        globalScope: 'unset',
        projectSlug: 'users-api',
        projectName: 'Users API',
        isLegacySnapshot: false,
      },
    });

    const detail = mapProjectSnapshotDetailFromApi({
      id: 'snapshot-1',
      projectId: 'project-1',
      name: 'Before imports',
      description: 'Safe point',
      createdAt: '2026-04-17T10:00:00.000Z',
      createdBy: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User' },
      revision: {
        endpointCount: 0,
        scenarioCount: 0,
        globalScope: 'all',
        projectSlug: 'users-api',
        projectName: 'Users API',
        isLegacySnapshot: false,
      },
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
    expect(snapshot.revision.scenarioCount).toBe(4);
    expect(detail.payload.project.name).toBe('Users API');
    expect(detail.payload.endpoints).toEqual([]);
  });

  it('maps restore preview groups into the frontend confirmation contract', () => {
    const preview = mapProjectSnapshotRestorePreviewFromApi({
      snapshotId: 'snapshot-1',
      snapshotName: 'Before imports',
      revision: {
        endpointCount: 2,
        scenarioCount: 3,
        globalScope: 'unset',
        projectSlug: 'users-api',
        projectName: 'Snapshot API',
        isLegacySnapshot: false,
      },
      project: {
        name: { current: 'Live API', snapshot: 'Snapshot API', changed: true },
        description: { current: 'Live description', snapshot: 'Snapshot description', changed: true },
      },
      globalConfig: {
        changed: true,
        changes: [{ field: 'scope', current: 'all', snapshot: 'unset' }],
      },
      endpoints: {
        create: [{ key: 'POST /users', method: 'POST', path: '/users' }],
        update: [{ key: 'GET /users', method: 'GET', path: '/users' }],
        delete: [{ key: 'DELETE /users/:id', method: 'DELETE', path: '/users/:id' }],
        keep: [],
      },
      counts: { create: 1, update: 1, delete: 1, keep: 0, totalAfterRestore: 2 },
    });

    expect(preview.snapshotId).toBe('snapshot-1');
    expect(preview.revision.endpointCount).toBe(2);
    expect(preview.endpoints.delete[0]?.path).toBe('/users/:id');
    expect(preview.counts.totalAfterRestore).toBe(2);
  });
});
