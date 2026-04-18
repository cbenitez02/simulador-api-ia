import { describe, expect, it } from 'vitest';
import {
  buildSnapshotPayload,
  buildSnapshotEndpointKey,
  planSnapshotEndpointReconciliation,
} from './service.js';

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
});
