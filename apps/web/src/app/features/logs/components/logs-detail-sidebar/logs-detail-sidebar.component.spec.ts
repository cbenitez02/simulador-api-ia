import { Injector, runInInjectionContext } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideAngularReactiveSchedulers, setupAngularVitest } from '../../../../testing/angular-vitest';
import type { ApiLogEntry } from '../../models/api-log.model';
import { LogsDetailSidebarComponent } from './logs-detail-sidebar.component';

setupAngularVitest();

type LogsDetailSidebarHarness = LogsDetailSidebarComponent & {
  executionSummary(log: ApiLogEntry): string;
};

const noScenarioLogFixture: ApiLogEntry = {
  id: 'log-no-scenario',
  method: 'GET',
  path: '/health',
  fullUrl: 'https://mock.example.com/health',
  origin: 'mock',
  statusCode: 200,
  latencyMs: 8,
  scenario: 'default',
  scenarioSelectionSource: 'direct-endpoint',
  scenarioName: null,
  hasScenario: false,
  createdAt: '2026-04-08T10:00:01.000Z',
  timeLabel: '10:00:01',
  requestHeaders: {},
  requestBody: null,
  responseHeaders: {},
  responseBody: { ok: true },
};

describe('LogsDetailSidebarComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reports explicit no matched scenario summary for direct endpoint logs', () => {
    const injector = Injector.create({ providers: [...provideAngularReactiveSchedulers()] });
    const component = runInInjectionContext(
      injector,
      () => new LogsDetailSidebarComponent(),
    ) as unknown as LogsDetailSidebarHarness;

    expect(component.executionSummary(noScenarioLogFixture)).toBe(
      'No scenario matched. Response came from the endpoint default payload.',
    );
  });
});
