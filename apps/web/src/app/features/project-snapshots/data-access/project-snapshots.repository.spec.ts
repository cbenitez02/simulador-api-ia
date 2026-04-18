import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { setupAngularVitest } from '../../../testing/angular-vitest';
import { ApiClient } from '../../../shared/http/api-client';
import { ProjectSnapshotsRepository } from './project-snapshots.repository';

setupAngularVitest();

describe('ProjectSnapshotsRepository', () => {
  function createRepository(api: object) {
    const injector = Injector.create({
      providers: [{ provide: ApiClient, useValue: api }],
    });

    return runInInjectionContext(injector, () => new ProjectSnapshotsRepository());
  }

  it('maps snapshot list, detail, create, and restore contracts through the dedicated project snapshot endpoints', async () => {
    const api = {
      get: vi
        .fn()
        .mockResolvedValueOnce({
          items: [
            {
              id: 'snapshot-1',
              projectId: 'project-1',
              name: 'Before imports',
              description: 'Safe point',
              createdAt: '2026-04-17T10:00:00.000Z',
              createdBy: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User' },
            },
          ],
        })
        .mockResolvedValueOnce({
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
        }),
      post: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'snapshot-2',
          projectId: 'project-1',
          name: 'Before restore',
          description: '',
          createdAt: '2026-04-17T10:05:00.000Z',
          createdBy: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User' },
        })
        .mockResolvedValueOnce({ restoredSnapshotId: 'snapshot-1' }),
    };

    const repository = createRepository(api);
    const list = await repository.list('project-1');
    const detail = await repository.get('project-1', 'snapshot-1');
    const created = await repository.create('project-1', { name: 'Before restore' });
    const restored = await repository.restore('project-1', 'snapshot-1');

    expect(api.get).toHaveBeenNthCalledWith(1, '/projects/project-1/snapshots');
    expect(api.get).toHaveBeenNthCalledWith(2, '/projects/project-1/snapshots/snapshot-1');
    expect(api.post).toHaveBeenNthCalledWith(1, '/projects/project-1/snapshots', { name: 'Before restore' });
    expect(api.post).toHaveBeenNthCalledWith(2, '/projects/project-1/snapshots/snapshot-1/restore', {});
    expect(list.items[0]?.createdBy.label).toBe('Owner User');
    expect(detail.payload.project.slug).toBe('users-api');
    expect(created.name).toBe('Before restore');
    expect(restored.restoredSnapshotId).toBe('snapshot-1');
  });
});
