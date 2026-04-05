import { describe, expect, it } from 'vitest';
import { mapDashboardProjectFromApi } from './project-api.mapper';

describe('project-api.mapper', () => {
  it('maps backend project data into dashboard shape', () => {
    const result = mapDashboardProjectFromApi(
      {
        id: 'p1',
        name: 'Users API',
        slug: 'users-api',
        description: '',
        updatedAt: new Date().toISOString(),
        _count: { endpoints: 1 },
      },
      [
        {
          id: 'e1',
          projectId: 'p1',
          method: 'POST',
          path: '/users',
          description: 'Create user',
          statusCode: 201,
          responseBody: { ok: true },
        },
      ],
    );

    expect(result.mockUrl).toBe('http://localhost:3000/mock/users-api');
    expect(result.description).toBe('Your mock API workspace.');
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0]?.method).toBe('POST');
  });
});
