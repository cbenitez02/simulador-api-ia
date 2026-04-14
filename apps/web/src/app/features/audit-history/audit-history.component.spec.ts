import { Injector, runInInjectionContext } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideAngularReactiveSchedulers, setupAngularVitest } from '../../testing/angular-vitest';
import type { AuditHistoryListResult, AuditHistoryEntry } from './models/audit-history.model';
import { AuditHistoryRepository } from './data-access/audit-history.repository';
import { AuditHistoryComponent } from './audit-history.component';

setupAngularVitest();

type AuditHistoryHarness = {
  projectId: () => string;
  loadProject(projectId: string): Promise<void>;
  entries: () => AuditHistoryEntry[];
  loading: () => boolean;
  loadingOlder: () => boolean;
  errorMessage: () => string | null;
  emptyStateMessage: () => string;
  olderHistoryAvailable: () => boolean;
  loadOlder(): void;
};

function createListResponse(
  items: AuditHistoryEntry[],
  serverTime = '2026-04-14T12:00:05.000Z',
): AuditHistoryListResult {
  return {
    items,
    nextCursor: items.at(-1) ? { createdAt: items.at(-1)!.createdAt, id: items.at(-1)!.id } : null,
    serverTime,
  };
}

const newestEntry: AuditHistoryEntry = {
  id: 'audit-2',
  actor: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User' },
  actorLabel: 'Owner User',
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  resourceType: 'endpoint',
  resourceId: 'endpoint-1',
  resourceLabel: 'GET /users',
  action: 'updated',
  summary: 'Updated endpoint GET /users',
  metadata: { endpointPath: '/users', method: 'GET' },
  createdAt: '2026-04-14T12:00:02.000Z',
  timeLabel: '12:00:02',
};

const olderEntry: AuditHistoryEntry = {
  ...newestEntry,
  id: 'audit-1',
  action: 'created',
  summary: 'Created endpoint GET /users',
  createdAt: '2026-04-14T12:00:01.000Z',
  timeLabel: '12:00:01',
};

async function flushAsyncWork(cycles = 6): Promise<void> {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
}

describe('AuditHistoryComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the latest project history and exposes a helpful empty state fallback', async () => {
    const listEvents = vi
      .fn<AuditHistoryRepository['listEvents']>()
      .mockResolvedValueOnce(createListResponse([newestEntry]))
      .mockResolvedValueOnce(createListResponse([]));

    const injector = Injector.create({
      providers: [
        ...provideAngularReactiveSchedulers(),
        {
          provide: AuditHistoryRepository,
          useValue: { listEvents },
        },
      ],
    });

    const component = runInInjectionContext(
      injector,
      () => new AuditHistoryComponent(),
    ) as unknown as AuditHistoryHarness;
    component.projectId = () => 'project-1';

    await component.loadProject('project-1');
    expect(component.entries()).toEqual([newestEntry]);
    expect(component.emptyStateMessage()).toBe('No audit history yet for this project.');

    await component.loadProject('project-1');
    expect(component.entries()).toEqual([]);
    expect(component.emptyStateMessage()).toBe('No audit history yet for this project.');
  });

  it('loads older history with tuple cursors and merges entries without duplicates', async () => {
    const listEvents = vi
      .fn<AuditHistoryRepository['listEvents']>()
      .mockResolvedValueOnce(createListResponse([newestEntry, olderEntry]))
      .mockResolvedValueOnce({
        items: [
          olderEntry,
          { ...olderEntry, id: 'audit-0', createdAt: '2026-04-14T12:00:00.000Z', timeLabel: '12:00:00' },
        ],
        nextCursor: { createdAt: '2026-04-14T12:00:00.000Z', id: 'audit-0' },
        serverTime: '2026-04-14T12:00:10.000Z',
      });

    const injector = Injector.create({
      providers: [
        ...provideAngularReactiveSchedulers(),
        {
          provide: AuditHistoryRepository,
          useValue: { listEvents },
        },
      ],
    });

    const component = runInInjectionContext(
      injector,
      () => new AuditHistoryComponent(),
    ) as unknown as AuditHistoryHarness;
    component.projectId = () => 'project-1';

    await component.loadProject('project-1');
    expect(component.olderHistoryAvailable()).toBe(true);

    component.loadOlder();
    await flushAsyncWork();

    expect(listEvents).toHaveBeenNthCalledWith(2, 'project-1', {
      direction: 'older',
      cursorCreatedAt: '2026-04-14T12:00:01.000Z',
      cursorId: 'audit-1',
    });
    expect(component.entries().map((entry) => entry.id)).toEqual(['audit-2', 'audit-1', 'audit-0']);
    expect(component.loadingOlder()).toBe(false);
  });
});
