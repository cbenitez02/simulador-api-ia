import { setupAngularVitest } from '../../../testing/angular-vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../../shared/http/api-client';
import { ProjectsRepository } from './projects.repository';

setupAngularVitest();

describe('ProjectsRepository', () => {
  function createRepository(api: object) {
    const injector = Injector.create({
      providers: [{ provide: ApiClient, useValue: api }],
    });

    return runInInjectionContext(injector, () => new ProjectsRepository());
  }

  it('loads projects and their endpoints', async () => {
    const api = {
      get: vi.fn(async (path: string) => {
        if (path === '/projects') {
          return [
            {
              id: 'p1',
              name: 'Users',
              slug: 'users',
              description: '',
              updatedAt: new Date().toISOString(),
              _count: { endpoints: 1 },
            },
          ];
        }

        return [
          {
            id: 'e1',
            projectId: 'p1',
            method: 'GET',
            path: '/users',
            description: '',
            statusCode: 200,
            responseBody: [],
          },
        ];
      }),
    };

    const repository = createRepository(api);
    const result = await repository.listProjects();

    expect(api.get).toHaveBeenCalledWith('/projects');
    expect(api.get).toHaveBeenCalledWith('/projects/p1/endpoints');
    expect(result[0]?.endpoints).toHaveLength(1);
  });
});
