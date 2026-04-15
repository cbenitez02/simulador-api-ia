import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { setupAngularVitest } from '../../../testing/angular-vitest';
import { ApiClient } from '../../../shared/http/api-client';
import { AuditHistoryRepository } from './audit-history.repository';

setupAngularVitest();

describe('AuditHistoryRepository', () => {
  function createRepository(api: object) {
    const injector = Injector.create({
      providers: [{ provide: ApiClient, useValue: api }],
    });

    return runInInjectionContext(injector, () => new AuditHistoryRepository());
  }

  it('maps backend audit events and serializes cursor filters using the logs-style contract', async () => {
    const api = {
      get: vi.fn(async () => ({
        items: [
          {
            id: 'audit-1',
            actor: {
              userId: 'user-1',
              email: 'owner@example.com',
              displayName: 'Owner User',
            },
            workspaceId: 'workspace-1',
            projectId: 'project-1',
            resourceType: 'endpoint',
            resourceId: 'endpoint-1',
            action: 'updated',
            summary: 'Updated endpoint GET /users',
            metadata: { endpointPath: '/users', method: 'GET' },
            createdAt: '2026-04-14T12:00:00.000Z',
          },
        ],
        nextCursor: { createdAt: '2026-04-14T12:00:00.000Z', id: 'audit-1' },
        serverTime: '2026-04-14T12:00:05.000Z',
      })),
    };

    const repository = createRepository(api);
    const result = await repository.listEvents('project-1', {
      limit: 25,
      direction: 'newer',
      cursorCreatedAt: '2026-04-14T11:59:00.000Z',
      cursorId: 'audit-0',
      resourceType: 'endpoint',
      action: 'updated',
    });

    expect(api.get).toHaveBeenCalledWith(
      '/projects/project-1/audit-events?limit=25&direction=newer&cursorCreatedAt=2026-04-14T11%3A59%3A00.000Z&cursorId=audit-0&resourceType=endpoint&action=updated',
    );
    expect(result.items[0]).toMatchObject({
      id: 'audit-1',
      resourceType: 'endpoint',
      action: 'updated',
      actorLabel: 'Owner User',
      resourceLabel: 'GET /users',
    });
    expect(result.nextCursor).toEqual({ createdAt: '2026-04-14T12:00:00.000Z', id: 'audit-1' });
  });

  it('omits empty optional query params', async () => {
    const api = {
      get: vi.fn(async () => ({ items: [], nextCursor: null, serverTime: '2026-04-14T12:00:05.000Z' })),
    };

    const repository = createRepository(api);

    await repository.listEvents('project-1', {
      action: undefined,
    });

    expect(api.get).toHaveBeenCalledWith('/projects/project-1/audit-events');
  });
});
