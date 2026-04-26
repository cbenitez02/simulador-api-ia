import { Injector, runInInjectionContext } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideAngularReactiveSchedulers, setupAngularVitest } from '../../testing/angular-vitest';
import type { ApiLogEntry, ApiLogListResult } from './models/api-log.model';
import { LogsRepository } from './data-access/logs.repository';
import { LogsComponent } from './logs.component';

setupAngularVitest();

type LogsComponentHarness = {
  projectId: () => string;
  loadProject(projectId: string): Promise<void>;
  searchQuery: { (): string; set(value: string): void };
  selectedLog: { (): ApiLogEntry | null; set(value: ApiLogEntry | null): void };
  filteredEntries: () => ApiLogEntry[];
  requestErrorMessage: () => string | null;
  methodFilter: {
    (): 'all' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    set(value: 'all' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'): void;
  };
  statusFilter: { (): 'all' | '2xx' | '3xx' | '4xx' | '5xx'; set(value: 'all' | '2xx' | '3xx' | '4xx' | '5xx'): void };
  endpointFilter: { (): string; set(value: string): void };
  entries: () => ApiLogEntry[];
  olderHistoryAvailable: () => boolean;
  loadingOlder: () => boolean;
  lastSuccessfulUpdate: () => string | null;
  refreshLogs(): void;
  loadOlderLogs(): void;
  onMethodChange(value: string): void;
  onStatusChange(value: string): void;
  onEndpointChange(value: string): void;
};

const newestLogFixture: ApiLogEntry = {
  id: 'log-2',
  method: 'POST',
  path: '/users',
  fullUrl: 'https://mock.example.com/users',
  origin: 'mock',
  statusCode: 201,
  latencyMs: 24,
  scenario: 'success',
  scenarioSelectionSource: 'weighted-random',
  scenarioName: 'create-user',
  hasScenario: true,
  createdAt: '2026-04-08T10:00:02.000Z',
  timeLabel: '10:00:02',
  requestHeaders: { 'content-type': 'application/json' },
  requestBody: { name: 'Ada' },
  responseHeaders: { 'x-mock': 'true' },
  responseBody: { ok: true },
};

const olderLogFixture: ApiLogEntry = {
  ...newestLogFixture,
  id: 'log-1',
  method: 'GET',
  statusCode: 200,
  scenarioSelectionSource: 'direct-endpoint',
  scenarioName: null,
  hasScenario: false,
  createdAt: '2026-04-08T10:00:01.000Z',
  timeLabel: '10:00:01',
  requestBody: null,
};

function createListResponse(items: ApiLogEntry[], serverTime = '2026-04-08T10:00:03.000Z'): ApiLogListResult {
  return {
    items,
    nextCursor: items.at(-1) ? { createdAt: items.at(-1)!.createdAt, id: items.at(-1)!.id } : null,
    serverTime,
  };
}

async function flushAsyncWork(cycles = 6): Promise<void> {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
}

describe('LogsComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves selected context when local search hides rows and refresh later fails', async () => {
    const listLogs = vi
      .fn<LogsRepository['listLogs']>()
      .mockResolvedValueOnce(createListResponse([newestLogFixture]))
      .mockRejectedValueOnce(new Error('Refresh failed for logs'));

    const injector = Injector.create({
      providers: [
        ...provideAngularReactiveSchedulers(),
        {
          provide: LogsRepository,
          useValue: {
            listLogs,
            clearLogs: vi.fn(async () => undefined),
          },
        },
      ],
    });

    const component = runInInjectionContext(injector, () => new LogsComponent()) as unknown as LogsComponentHarness;
    component.projectId = () => 'p1';

    await component.loadProject('p1');
    component.selectedLog.set(newestLogFixture);
    component.searchQuery.set('zzz');
    await flushAsyncWork();

    expect(component.filteredEntries()).toEqual([]);
    expect(component.selectedLog()?.id).toBe('log-2');

    component.refreshLogs();
    await flushAsyncWork();

    expect(component.requestErrorMessage()).toBe('Refresh failed for logs');
    expect(component.searchQuery()).toBe('zzz');
    expect(component.selectedLog()?.id).toBe('log-2');
  });

  it('reloads from the backend when server-side filters change', async () => {
    const listLogs = vi
      .fn<LogsRepository['listLogs']>()
      .mockResolvedValueOnce(createListResponse([newestLogFixture]))
      .mockResolvedValueOnce(createListResponse([newestLogFixture], '2026-04-08T10:00:04.000Z'))
      .mockResolvedValueOnce(createListResponse([newestLogFixture], '2026-04-08T10:00:05.000Z'))
      .mockResolvedValueOnce(createListResponse([newestLogFixture], '2026-04-08T10:00:06.000Z'));

    const injector = Injector.create({
      providers: [
        ...provideAngularReactiveSchedulers(),
        {
          provide: LogsRepository,
          useValue: {
            listLogs,
            clearLogs: vi.fn(async () => undefined),
          },
        },
      ],
    });

    const component = runInInjectionContext(injector, () => new LogsComponent()) as unknown as LogsComponentHarness;
    component.projectId = () => 'p1';

    await component.loadProject('p1');

    component.onMethodChange('POST');
    await flushAsyncWork();

    component.onStatusChange('3xx');
    await flushAsyncWork();

    component.onEndpointChange('/users');
    await flushAsyncWork();

    expect(listLogs).toHaveBeenNthCalledWith(2, 'p1', { method: 'POST' });
    expect(listLogs).toHaveBeenNthCalledWith(3, 'p1', { method: 'POST', statusBucket: '3xx' });
    expect(listLogs).toHaveBeenNthCalledWith(4, 'p1', {
      method: 'POST',
      statusBucket: '3xx',
      path: '/users',
    });
  });

  it('loads older history with older tuple cursors and merges without duplicates', async () => {
    const listLogs = vi
      .fn<LogsRepository['listLogs']>()
      .mockResolvedValueOnce(createListResponse([newestLogFixture, olderLogFixture]))
      .mockResolvedValueOnce({
        items: [
          olderLogFixture,
          { ...olderLogFixture, id: 'log-0', createdAt: '2026-04-08T10:00:00.000Z', timeLabel: '10:00:00' },
        ],
        nextCursor: { createdAt: '2026-04-08T10:00:00.000Z', id: 'log-0' },
        serverTime: '2026-04-08T10:00:06.000Z',
      });

    const injector = Injector.create({
      providers: [
        ...provideAngularReactiveSchedulers(),
        {
          provide: LogsRepository,
          useValue: {
            listLogs,
            clearLogs: vi.fn(async () => undefined),
          },
        },
      ],
    });

    const component = runInInjectionContext(injector, () => new LogsComponent()) as unknown as LogsComponentHarness;
    component.projectId = () => 'p1';

    await component.loadProject('p1');
    expect(component.olderHistoryAvailable()).toBe(true);

    component.loadOlderLogs();
    await flushAsyncWork();

    expect(listLogs).toHaveBeenNthCalledWith(2, 'p1', {
      direction: 'older',
      cursorCreatedAt: '2026-04-08T10:00:01.000Z',
      cursorId: 'log-1',
    });
    expect(component.entries().map((entry) => entry.id)).toEqual(['log-2', 'log-1', 'log-0']);
    expect(component.lastSuccessfulUpdate()).toBe('2026-04-08T10:00:06.000Z');
    expect(component.loadingOlder()).toBe(false);
  });
});
