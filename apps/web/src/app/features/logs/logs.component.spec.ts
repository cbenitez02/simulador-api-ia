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
  refreshLogs(): void;
};

const logEntryFixture: ApiLogEntry = {
  id: 'log-1',
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

function createListResponse(items: ApiLogEntry[]): ApiLogListResult {
  return {
    items,
    nextCursor: items[0] ? { createdAt: items[0].createdAt, id: items[0].id } : null,
    serverTime: '2026-04-08T10:00:03.000Z',
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

  it('preserves selected context when filters hide rows and refresh later fails', async () => {
    const listLogs = vi
      .fn<LogsRepository['listLogs']>()
      .mockResolvedValueOnce(createListResponse([logEntryFixture]))
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
    component.selectedLog.set(logEntryFixture);
    component.searchQuery.set('zzz');
    await flushAsyncWork();

    expect(component.filteredEntries()).toEqual([]);
    expect(component.selectedLog()?.id).toBe('log-1');

    component.refreshLogs();
    await flushAsyncWork();

    expect(component.requestErrorMessage()).toBe('Refresh failed for logs');
    expect(component.searchQuery()).toBe('zzz');
    expect(component.selectedLog()?.id).toBe('log-1');
  });
});
