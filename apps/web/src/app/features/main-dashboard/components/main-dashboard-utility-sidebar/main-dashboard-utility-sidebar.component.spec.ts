import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { provideAngularReactiveSchedulers, setupAngularVitest } from '../../../../testing/angular-vitest';
import type { DashboardProject } from '../../models/dashboard-project.model';
import { MainDashboardUtilitySidebarComponent } from './main-dashboard-utility-sidebar.component';

setupAngularVitest();

type MainDashboardUtilityHarness = MainDashboardUtilitySidebarComponent & {
  recentRequests: () => Array<{
    id: string;
    requestLabel: string;
    statusCode: number;
    latencyMs: number;
    scenarioType: string;
    timeLabel: string;
  }>;
  globalConfigRows: () => Array<{ label: string; badge: string; tone: 'neutral' | 'success' }>;
};

const projectFixture: DashboardProject = {
  id: 'p1',
  name: 'Users API',
  slug: 'users-api',
  status: 'running',
  mockUrl: 'http://localhost:3000/mock/users-api',
  description: 'Traffic-backed project',
  lastUpdatedRelative: 'just now',
  metrics: {
    totalEndpoints: 1,
    totalScenarios: 2,
    avgLatencyMs: 95,
    errorRatePct: 12.5,
    totalRequests: 4,
  },
  health: {
    readyEndpoints: 1,
    needsAttentionEndpoints: 0,
    errorScenarioEndpoints: 1,
    emptyScenarioEndpoints: 0,
    timeoutScenarioEndpoints: 0,
  },
  endpointRows: [],
  recentRequests: [
    {
      id: 'log-1',
      method: 'POST',
      path: '/users',
      statusCode: 500,
      latencyMs: 140,
      scenarioType: 'error',
      createdAt: '2026-04-08T10:00:00.000Z',
      timeLabel: 'just now',
    },
  ],
  configSummary: {
    latency: { enabled: true, mode: 'range', minMs: 50, maxMs: 250 },
    errorSimulation: { enabled: true, ratePct: 15, codes: [400, 500] },
    rateLimiting: { enabled: true, rpm: 90 },
    logging: { level: 'full' },
    scope: 'all',
  },
  endpoints: [],
};

describe('MainDashboardUtilitySidebarComponent', () => {
  it('derives recent request traffic and persisted config badges instead of seeded placeholder activity', () => {
    const injector = Injector.create({ providers: [...provideAngularReactiveSchedulers()] });
    const component = runInInjectionContext(
      injector,
      () => new MainDashboardUtilitySidebarComponent(),
    ) as unknown as MainDashboardUtilityHarness & { project: () => DashboardProject };

    component.project = () => projectFixture;

    expect(component.recentRequests()).toEqual([
      {
        id: 'log-1',
        requestLabel: 'POST /users',
        statusCode: 500,
        latencyMs: 140,
        scenarioType: 'error',
        timeLabel: 'just now',
      },
    ]);
    expect(component.globalConfigRows()).toEqual([
      { label: 'Default latency', badge: '50–250ms', tone: 'neutral' },
      { label: 'Error simulation', badge: '15% · 400, 500', tone: 'success' },
      { label: 'Rate limiting', badge: '90 req/min', tone: 'neutral' },
      { label: 'Logging', badge: 'Full', tone: 'neutral' },
    ]);
  });

  it('keeps recent request traffic empty when the summary has no traffic yet', () => {
    const injector = Injector.create({ providers: [...provideAngularReactiveSchedulers()] });
    const component = runInInjectionContext(
      injector,
      () => new MainDashboardUtilitySidebarComponent(),
    ) as unknown as MainDashboardUtilityHarness & { project: () => DashboardProject };

    component.project = () => ({ ...projectFixture, recentRequests: [] });

    expect(component.recentRequests()).toEqual([]);
  });
});
