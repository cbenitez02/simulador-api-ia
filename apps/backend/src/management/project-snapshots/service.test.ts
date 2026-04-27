import { beforeAll, describe, expect, it, vi } from 'vitest';
import type * as ProjectSnapshotsService from './service.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    projectSnapshot: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    auditEvent: { findMany: vi.fn(), create: vi.fn() },
    endpoint: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

let buildSnapshotPayload: typeof ProjectSnapshotsService.buildSnapshotPayload;
let buildSnapshotEndpointKey: typeof ProjectSnapshotsService.buildSnapshotEndpointKey;
let planSnapshotEndpointReconciliation: typeof ProjectSnapshotsService.planSnapshotEndpointReconciliation;
let buildProjectSnapshotRestorePreview: typeof ProjectSnapshotsService.buildProjectSnapshotRestorePreview;

beforeAll(async () => {
  ({ buildSnapshotPayload, buildSnapshotEndpointKey, planSnapshotEndpointReconciliation } =
    await import('./service.js'));
  ({ buildProjectSnapshotRestorePreview } = await import('./service.js'));
});

describe('project-snapshots/service helpers', () => {
  it('normalizes canonical project state into an immutable snapshot payload', () => {
    const payload = buildSnapshotPayload({
      id: 'project-1',
      slug: 'users-api',
      name: 'Users API',
      description: 'Project snapshot',
      globalConfig: null,
      endpoints: [
        {
          method: 'post',
          path: '/users',
          description: 'Create user',
          statusCode: 201,
          responseBody: { ok: true },
          endpointConfig: null,
          scenarios: [
            {
              name: 'created',
              type: 'success',
              statusCode: 201,
              body: { ok: true },
              delayMs: 0,
              weight: 1,
            },
          ],
        },
        {
          method: 'get',
          path: '/users',
          description: '',
          statusCode: 200,
          responseBody: [{ id: 1 }],
          endpointConfig: {
            latencyMode: 'range',
            fixedDelayMs: 0,
            minDelayMs: 50,
            maxDelayMs: 150,
            errorRate: 0,
            useScenarioWeights: true,
          },
          scenarios: [
            {
              name: 'ok',
              type: 'success',
              statusCode: 200,
              body: [{ id: 1 }],
              delayMs: 10,
              weight: 2,
            },
          ],
        },
      ],
    });

    expect(payload.project).toEqual({
      id: 'project-1',
      slug: 'users-api',
      name: 'Users API',
      description: 'Project snapshot',
    });
    expect(payload.globalConfig.projectId).toBe('project-1');
    expect(payload.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).toEqual([
      'GET /users',
      'POST /users',
    ]);
    expect(payload.endpoints[0]?.endpointConfig).toEqual({
      latencyMode: 'range',
      fixedDelayMs: 0,
      minDelayMs: 50,
      maxDelayMs: 150,
      errorRate: 0,
      useScenarioWeights: true,
    });
    expect(payload.endpoints[1]?.endpointConfig).toEqual({
      latencyMode: 'fixed',
      fixedDelayMs: 0,
      minDelayMs: 0,
      maxDelayMs: 500,
      errorRate: 0,
      useScenarioWeights: true,
    });
  });

  it('reconciles live endpoints against snapshot keys and marks absent live records for deletion', () => {
    const plan = planSnapshotEndpointReconciliation(
      [
        { method: 'GET', path: '/users' },
        { method: 'POST', path: '/users' },
      ],
      [
        { id: 'live-1', method: 'GET', path: '/users' },
        { id: 'live-2', method: 'DELETE', path: '/users/:id' },
      ]
    );

    expect(plan.keep.map((entry) => entry.key)).toEqual(['GET /users']);
    expect(plan.create.map((entry) => buildSnapshotEndpointKey(entry.method, entry.path))).toEqual([
      'POST /users',
    ]);
    expect(plan.deleteIds).toEqual(['live-2']);
  });

  it('captures only canonical management state and omits out-of-scope runtime or membership data', () => {
    const payload = buildSnapshotPayload({
      id: 'project-1',
      slug: 'users-api',
      name: 'Users API',
      description: 'Project snapshot',
      globalConfig: {
        latencyEnabled: true,
        latencyMinMs: 25,
        latencyMaxMs: 125,
        latencyMode: 'range',
        errorSimulationEnabled: false,
        errorSimulationRate: 0,
        errorSimulationCodes: [500],
        rateLimitingEnabled: true,
        rateLimitingRpm: 90,
        loggingLevel: 'full',
        scope: 'all',
        authTokens: ['secret-token'],
        runtimeLogs: [{ id: 'log-1' }],
      } as never,
      endpoints: [
        {
          method: 'get',
          path: '/users',
          description: 'List users',
          statusCode: 200,
          responseBody: [{ id: 1 }],
          endpointConfig: {
            latencyMode: 'fixed',
            fixedDelayMs: 10,
            minDelayMs: 10,
            maxDelayMs: 10,
            errorRate: 0,
            useScenarioWeights: true,
            runtimeState: { requests: 99 },
          } as never,
          scenarios: [
            {
              name: 'ok',
              type: 'success',
              statusCode: 200,
              body: [{ id: 1 }],
              delayMs: 0,
              weight: 1,
              authContext: { userId: 'viewer-1' },
            } as never,
          ],
          workspaceMembers: [{ userId: 'viewer-1' }],
        } as never,
      ],
      workspaceMembers: [{ userId: 'viewer-1', role: 'viewer' }],
      runtimeLogs: [{ id: 'log-1' }],
    } as never);

    expect(payload).toEqual({
      project: {
        id: 'project-1',
        slug: 'users-api',
        name: 'Users API',
        description: 'Project snapshot',
      },
      globalConfig: {
        projectId: 'project-1',
        latencyEnabled: true,
        latencyMinMs: 25,
        latencyMaxMs: 125,
        latencyMode: 'range',
        errorSimulationEnabled: false,
        errorSimulationRate: 0,
        errorSimulationCodes: [500],
        rateLimitingEnabled: true,
        rateLimitingRpm: 90,
        loggingLevel: 'full',
        scope: 'all',
      },
      endpoints: [
        {
          method: 'GET',
          path: '/users',
          description: 'List users',
          statusCode: 200,
          responseBody: [{ id: 1 }],
          endpointConfig: {
            latencyMode: 'fixed',
            fixedDelayMs: 10,
            minDelayMs: 10,
            maxDelayMs: 10,
            errorRate: 0,
            useScenarioWeights: true,
          },
          scenarios: [
            {
              name: 'ok',
              type: 'success',
              statusCode: 200,
              body: [{ id: 1 }],
              delayMs: 0,
              weight: 1,
            },
          ],
        },
      ],
    });
  });

  it('preserves snapshot globalConfig scope instead of coercing it to all', () => {
    const payload = buildSnapshotPayload({
      id: 'project-1',
      slug: 'users-api',
      name: 'Users API',
      description: 'Project snapshot',
      globalConfig: {
        latencyEnabled: false,
        latencyMinMs: 0,
        latencyMaxMs: 1000,
        latencyMode: 'fixed',
        errorSimulationEnabled: false,
        errorSimulationRate: 0,
        errorSimulationCodes: [500],
        rateLimitingEnabled: false,
        rateLimitingRpm: 60,
        loggingLevel: 'basic',
        scope: 'unset',
      },
      endpoints: [],
    });

    expect(payload.globalConfig.scope).toBe('unset');
  });

  it('builds a restore preview with metadata, config, and endpoint change groups', () => {
    const preview = buildProjectSnapshotRestorePreview(
      {
        project: {
          id: 'project-1',
          slug: 'users-api',
          name: 'Snapshot Users API',
          description: 'Snapshot description',
        },
        globalConfig: {
          projectId: 'project-1',
          latencyEnabled: true,
          latencyMinMs: 10,
          latencyMaxMs: 20,
          latencyMode: 'range',
          errorSimulationEnabled: false,
          errorSimulationRate: 0,
          errorSimulationCodes: [500],
          rateLimitingEnabled: false,
          rateLimitingRpm: 60,
          loggingLevel: 'full',
          scope: 'unset',
        },
        endpoints: [
          {
            method: 'GET',
            path: '/users',
            description: 'Snapshot list users',
            statusCode: 200,
            responseBody: [{ id: 1 }],
            endpointConfig: {
              latencyMode: 'fixed',
              fixedDelayMs: 0,
              minDelayMs: 0,
              maxDelayMs: 500,
              errorRate: 0,
              useScenarioWeights: true,
            },
            scenarios: [],
          },
          {
            method: 'POST',
            path: '/users',
            description: 'Create user',
            statusCode: 201,
            responseBody: { ok: true },
            endpointConfig: {
              latencyMode: 'fixed',
              fixedDelayMs: 0,
              minDelayMs: 0,
              maxDelayMs: 500,
              errorRate: 0,
              useScenarioWeights: true,
            },
            scenarios: [],
          },
        ],
      },
      {
        project: {
          id: 'project-1',
          slug: 'users-api',
          name: 'Live Users API',
          description: 'Live description',
        },
        globalConfig: {
          projectId: 'project-1',
          latencyEnabled: false,
          latencyMinMs: 0,
          latencyMaxMs: 1000,
          latencyMode: 'fixed',
          errorSimulationEnabled: false,
          errorSimulationRate: 0,
          errorSimulationCodes: [500],
          rateLimitingEnabled: false,
          rateLimitingRpm: 60,
          loggingLevel: 'basic',
          scope: 'all',
        },
        endpoints: [
          {
            id: 'endpoint-1',
            method: 'GET',
            path: '/users',
            description: 'Live list users',
            statusCode: 200,
            responseBody: [],
            endpointConfig: {
              latencyMode: 'fixed',
              fixedDelayMs: 0,
              minDelayMs: 0,
              maxDelayMs: 500,
              errorRate: 0,
              useScenarioWeights: true,
            },
            scenarios: [],
          },
          {
            id: 'endpoint-2',
            method: 'DELETE',
            path: '/users/:id',
            description: 'Delete user',
            statusCode: 204,
            responseBody: null,
            endpointConfig: {
              latencyMode: 'fixed',
              fixedDelayMs: 0,
              minDelayMs: 0,
              maxDelayMs: 500,
              errorRate: 0,
              useScenarioWeights: true,
            },
            scenarios: [],
          },
        ],
      }
    );

    expect(preview.project.name).toEqual({
      current: 'Live Users API',
      snapshot: 'Snapshot Users API',
      changed: true,
    });
    expect(preview.project.description).toEqual({
      current: 'Live description',
      snapshot: 'Snapshot description',
      changed: true,
    });
    expect(preview.revision).toEqual({
      endpointCount: 2,
      scenarioCount: 0,
      globalScope: 'unset',
      projectSlug: 'users-api',
      projectName: 'Snapshot Users API',
      isLegacySnapshot: false,
    });
    expect(preview.globalConfig.changed).toBe(true);
    expect(preview.globalConfig.changes.map((entry) => entry.field)).toEqual([
      'latencyEnabled',
      'latencyMinMs',
      'latencyMaxMs',
      'latencyMode',
      'loggingLevel',
      'scope',
    ]);
    expect(preview.endpoints.create.map((entry) => entry.key)).toEqual(['POST /users']);
    expect(preview.endpoints.update.map((entry) => entry.key)).toEqual(['GET /users']);
    expect(preview.endpoints.delete.map((entry) => entry.key)).toEqual(['DELETE /users/:id']);
    expect(preview.endpoints.keep).toEqual([]);
    expect(preview.counts).toEqual({
      create: 1,
      update: 1,
      delete: 1,
      keep: 0,
      totalAfterRestore: 2,
    });
  });
});
