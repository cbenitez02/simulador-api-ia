import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  provideAngularReactiveSchedulers,
  resolveAngularExternalResources,
  setupAngularVitest,
} from '../../testing/angular-vitest';
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
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor: lastItem ? { createdAt: lastItem.createdAt, id: lastItem.id } : null,
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
  actionLabel: 'updated',
  summary: 'Updated endpoint GET /users',
  metadata: { endpointPath: '/users', method: 'GET' },
  createdAt: '2026-04-14T12:00:02.000Z',
  timeLabel: '12:00:02',
};

const olderEntry: AuditHistoryEntry = {
  ...newestEntry,
  id: 'audit-1',
  action: 'created',
  actionLabel: 'created',
  summary: 'Created endpoint GET /users',
  createdAt: '2026-04-14T12:00:01.000Z',
  timeLabel: '12:00:01',
};

async function flushAsyncWork(cycles = 6): Promise<void> {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
}

async function renderComponent(
  listEvents: AuditHistoryRepository['listEvents'],
  inputs?: Partial<{
    projectId: string;
    canRestoreSnapshots: boolean;
  }>,
): Promise<HTMLElement> {
  await resolveAngularExternalResources();
  await TestBed.configureTestingModule({
    imports: [AuditHistoryComponent],
    providers: [{ provide: AuditHistoryRepository, useValue: { listEvents } }],
  }).compileComponents();

  const fixture = TestBed.createComponent(AuditHistoryComponent);
  const component = fixture.componentInstance as unknown as {
    projectId: () => string;
    canRestoreSnapshots: () => boolean;
  };
  component.projectId = () => inputs?.projectId ?? 'project-1';
  component.canRestoreSnapshots = () => inputs?.canRestoreSnapshots ?? false;
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture.nativeElement as HTMLElement;
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
    const initialItems: AuditHistoryEntry[] = [
      newestEntry,
      olderEntry,
      ...Array.from({ length: 23 }, (_, index) => {
        const minute = String(59 - index).padStart(2, '0');
        return {
          ...olderEntry,
          id: `audit-seed-${index}`,
          createdAt: `2026-04-14T11:${minute}:00.000Z`,
          timeLabel: `11:${minute}:00`,
        };
      }),
    ];
    const initialCursor = initialItems.at(-1)!;
    const listEvents = vi
      .fn<AuditHistoryRepository['listEvents']>()
      .mockResolvedValueOnce(createListResponse(initialItems))
      .mockResolvedValueOnce({
        items: [
          initialCursor,
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
      limit: 25,
      direction: 'older',
      cursorCreatedAt: initialCursor.createdAt,
      cursorId: initialCursor.id,
    });
    expect(component.entries().some((entry) => entry.id === 'audit-0')).toBe(true);
    expect(component.entries().length).toBe(26);
    expect(component.loadingOlder()).toBe(false);
  });

  it('does not render the restore snapshot CTA for read-only viewers', async () => {
    const snapshotEntry: AuditHistoryEntry = {
      id: 'audit-snapshot-1',
      actor: { userId: 'user-1', email: 'owner@example.com', displayName: 'Owner User' },
      actorLabel: 'Owner User',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      resourceType: 'snapshot',
      resourceId: 'snapshot-1',
      resourceLabel: 'Before imports',
      action: 'created',
      actionLabel: 'saved revision',
      summary: 'Created revision Before imports',
      detailsLabel: '2 endpoints · 3 scenarios · scope unset',
      resourceTypeLabel: 'revision',
      metadata: { snapshotName: 'Before imports', endpointCount: 2, scenarioCount: 3, scope: 'unset' },
      createdAt: '2026-04-14T12:00:00.000Z',
      timeLabel: '12:00:00',
    };
    const listEvents = vi
      .fn<AuditHistoryRepository['listEvents']>()
      .mockResolvedValue(createListResponse([snapshotEntry]));

    const element = await renderComponent(listEvents, {
      projectId: 'project-1',
      canRestoreSnapshots: false,
    });

    expect(element.textContent).toContain('Created revision Before imports');
    expect(element.textContent).toContain('2 endpoints · 3 scenarios · scope unset');
    expect(
      Array.from(element.querySelectorAll('button')).some((button) => button.textContent?.includes('Restore revision')),
    ).toBe(false);
  });
});
