import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { provideAngularReactiveSchedulers, setupAngularVitest } from '../../../../testing/angular-vitest';
import type { DashboardProject } from '../../models/dashboard-project.model';
import { MainDashboardDataComponent } from './main-dashboard-data.component';

setupAngularVitest();

type MainDashboardDataHarness = MainDashboardDataComponent & {
  projectStatusLabel: () => string;
  metrics: () => DashboardProject['metrics'];
  health: () => DashboardProject['health'];
  endpointRows: () => DashboardProject['endpointRows'];
};

function bindProjectInput(component: { project: unknown }, project: DashboardProject): void {
  component.project = (() => project) as typeof component.project;
}

const projectFixture: DashboardProject = {
  id: 'p1',
  name: 'Users API',
  slug: 'users-api',
  status: 'attention',
  mockUrl: 'https://mock.example.com/users-api',
  description: 'Real dashboard project',
  lastUpdatedRelative: 'just now',
  metrics: {
    totalEndpoints: 2,
    totalScenarios: 3,
    avgLatencyMs: 120,
    errorRatePct: 25,
    totalRequests: 8,
  },
  health: {
    readyEndpoints: 1,
    needsAttentionEndpoints: 1,
    errorScenarioEndpoints: 1,
    emptyScenarioEndpoints: 0,
    timeoutScenarioEndpoints: 0,
  },
  endpointRows: [
    {
      endpointId: 'e1',
      method: 'GET',
      path: '/users',
      description: 'List users',
      scenarioCount: 3,
      latencyMs: 120,
      errorRatePct: 25,
      status: 'ready',
    },
    {
      endpointId: 'e2',
      method: 'POST',
      path: '/users',
      description: 'Create user',
      scenarioCount: 0,
      latencyMs: 0,
      errorRatePct: 0,
      status: 'needs-attention',
    },
  ],
  recentRequests: [],
  configSummary: {
    latency: { enabled: false, mode: 'fixed', minMs: 0, maxMs: 1000 },
    errorSimulation: { enabled: false, ratePct: 0, codes: [500] },
    rateLimiting: { enabled: false, rpm: 60 },
    logging: { level: 'basic' },
    scope: 'all',
  },
  endpoints: [],
};

describe('MainDashboardDataComponent', () => {
  it('exposes real metrics, project status, and endpoint health rows from the summary payload', () => {
    const injector = Injector.create({ providers: [...provideAngularReactiveSchedulers()] });
    const component = runInInjectionContext(
      injector,
      () => new MainDashboardDataComponent(),
    ) as unknown as MainDashboardDataHarness & { project: () => DashboardProject };

    bindProjectInput(component, projectFixture);

    expect(component.projectStatusLabel()).toBe('Needs attention');
    expect(component.metrics()).toEqual(projectFixture.metrics);
    expect(component.health()).toEqual(projectFixture.health);
    expect(component.endpointRows()).toEqual(projectFixture.endpointRows);
    expect(component.endpointRows()[1]?.status).toBe('needs-attention');
  });
});
