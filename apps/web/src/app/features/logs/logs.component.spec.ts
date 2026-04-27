import { Component, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  provideAngularReactiveSchedulers,
  resolveAngularExternalResources,
  setupAngularVitest,
} from '../../testing/angular-vitest';
import type { ApiLogEntry, ApiLogListResult } from './models/api-log.model';
import { LogsRepository } from './data-access/logs.repository';
import { LogsComponent } from './logs.component';
import { SelectMenuComponent } from '../../shared/ui/select-menu/select-menu.component';

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

@Component({
  standalone: true,
  imports: [SelectMenuComponent],
  template: `
    <app-select-menu
      [options]="methodFilterOptions"
      [value]="methodFilter()"
      (valueChange)="onMethodChange($event)"
      [triggerId]="'logs-method-filter-trigger'"
      [listboxId]="'logs-method-filter-listbox'"
    />
    <app-select-menu
      [options]="statusFilterOptions"
      [value]="statusFilter()"
      (valueChange)="onStatusChange($event)"
      [triggerId]="'logs-status-filter-trigger'"
      [listboxId]="'logs-status-filter-listbox'"
    />
    <app-select-menu
      [options]="endpointFilterOptions()"
      [value]="endpointFilter()"
      (valueChange)="onEndpointChange($event)"
      [triggerId]="'logs-endpoint-filter-trigger'"
      [listboxId]="'logs-endpoint-filter-listbox'"
    />
  `,
})
class LogsFiltersHarnessComponent {
  component!: LogsComponentHarness & {
    methodFilterOptions: readonly { value: string; label: string }[];
    statusFilterOptions: readonly { value: string; label: string }[];
    endpointFilterOptions: () => readonly { value: string; label: string }[];
  };

  get methodFilterOptions() {
    return this.component.methodFilterOptions;
  }

  get statusFilterOptions() {
    return this.component.statusFilterOptions;
  }

  endpointFilterOptions() {
    return this.component.endpointFilterOptions();
  }

  methodFilter() {
    return this.component.methodFilter();
  }

  statusFilter() {
    return this.component.statusFilter();
  }

  endpointFilter() {
    return this.component.endpointFilter();
  }

  onMethodChange(value: string) {
    this.component.onMethodChange(value);
  }

  onStatusChange(value: string) {
    this.component.onStatusChange(value);
  }

  onEndpointChange(value: string) {
    this.component.onEndpointChange(value);
  }
}

async function renderLogsFiltersHarness(component: LogsFiltersHarnessComponent['component']) {
  await resolveAngularExternalResources();
  await TestBed.configureTestingModule({
    imports: [LogsFiltersHarnessComponent],
  }).compileComponents();

  const fixture = TestBed.createComponent(LogsFiltersHarnessComponent);
  fixture.componentInstance.component = component;
  fixture.detectChanges(false);

  return fixture;
}

async function pickSelectMenuOption(
  fixture: Awaited<ReturnType<typeof renderLogsFiltersHarness>>,
  triggerId: string,
  listboxId: string,
  optionLabel: string,
): Promise<void> {
  const element = fixture.nativeElement as HTMLElement;
  const trigger = element.querySelector<HTMLButtonElement>(`#${triggerId}`);

  if (!trigger) {
    throw new Error(`Select menu trigger not rendered: ${triggerId}`);
  }

  trigger.click();
  fixture.detectChanges(false);

  const option = Array.from(element.querySelectorAll<HTMLButtonElement>(`#${listboxId} .select-menu__option`)).find(
    (candidate) => candidate.textContent?.includes(optionLabel),
  );

  if (!option) {
    throw new Error(`Select menu option not rendered: ${optionLabel}`);
  }

  option.click();
  await fixture.whenStable();
  fixture.detectChanges(false);
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

  it('reloads from the backend when server-side filters change through the rendered select menus', async () => {
    const listLogs = vi
      .fn<LogsRepository['listLogs']>()
      .mockImplementationOnce(
        async () =>
          await new Promise<ApiLogListResult>((resolve) => {
            setTimeout(() => resolve(createListResponse([newestLogFixture])), 0);
          }),
      )
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

    const component = runInInjectionContext(
      injector,
      () => new LogsComponent(),
    ) as unknown as LogsFiltersHarnessComponent['component'];
    component.projectId = () => 'p1';
    await component.loadProject('p1');

    const fixture = await renderLogsFiltersHarness(component);
    const element = fixture.nativeElement as HTMLElement;

    await pickSelectMenuOption(fixture, 'logs-method-filter-trigger', 'logs-method-filter-listbox', 'POST');
    await pickSelectMenuOption(fixture, 'logs-status-filter-trigger', 'logs-status-filter-listbox', '3xx');
    await pickSelectMenuOption(fixture, 'logs-endpoint-filter-trigger', 'logs-endpoint-filter-listbox', '/users');

    expect(listLogs).toHaveBeenNthCalledWith(2, 'p1', { method: 'POST' });
    expect(listLogs).toHaveBeenNthCalledWith(3, 'p1', { method: 'POST', statusBucket: '3xx' });
    expect(listLogs).toHaveBeenNthCalledWith(4, 'p1', {
      method: 'POST',
      statusBucket: '3xx',
      path: '/users',
    });
    expect(element.querySelector('#logs-method-filter-trigger')?.textContent).toContain('POST');
    expect(element.querySelector('#logs-status-filter-trigger')?.textContent).toContain('3xx');
    expect(element.querySelector('#logs-endpoint-filter-trigger')?.textContent).toContain('/users');
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
