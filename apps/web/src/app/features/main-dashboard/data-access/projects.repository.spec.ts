import { setupAngularVitest } from '../../../testing/angular-vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../../shared/http/api-client';
import { ProjectsRepository } from './projects.repository';

const projectDto = {
  id: 'p1',
  name: 'Users',
  slug: 'users',
  description: '',
  updatedAt: new Date().toISOString(),
  _count: { endpoints: 1 },
};

const endpointDto = {
  id: 'e1',
  projectId: 'p1',
  method: 'GET',
  path: '/users',
  description: '',
  statusCode: 200,
  responseBody: [],
};

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
        if (path === '/projects') return [projectDto];
        return [endpointDto];
      }),
    };

    const repository = createRepository(api);
    const result = await repository.listProjects();

    expect(api.get).toHaveBeenCalledWith('/projects');
    expect(api.get).toHaveBeenCalledWith('/projects/p1/endpoints');
    expect(result[0]?.endpoints).toHaveLength(1);
  });

  it('updates a project with a partial payload and remaps the refreshed project', async () => {
    const api = {
      get: vi.fn(async () => [endpointDto]),
      patch: vi.fn(async () => ({
        ...projectDto,
        name: 'Users v2',
        description: 'Updated description',
      })),
    };

    const repository = createRepository(api);
    const result = await repository.updateProject('p1', { name: 'Users v2' });

    expect(api.patch).toHaveBeenCalledWith('/projects/p1', { name: 'Users v2' });
    expect(api.get).toHaveBeenCalledWith('/projects/p1/endpoints');
    expect(result.name).toBe('Users v2');
    expect(result.description).toBe('Updated description');
    expect(result.mockUrl).toBe('http://localhost:3000/mock/users');
  });

  it('deletes a project through the backend endpoint', async () => {
    const api = {
      delete: vi.fn(async () => undefined),
    };

    const repository = createRepository(api);
    await repository.deleteProject('p1');

    expect(api.delete).toHaveBeenCalledWith('/projects/p1');
  });
});
