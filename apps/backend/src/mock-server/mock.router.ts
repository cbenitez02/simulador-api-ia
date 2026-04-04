import { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { applyLatency, calculateLatency } from './latency.js';
import { logRequest } from './logger.js';
import { selectScenario } from './scenario-selector.js';

export const mockRouter = Router();

function toStringHeaders(headers: Record<string, unknown>): Record<string, string> {
  const normalizedEntries = Object.entries(headers).map(([key, value]) => {
    if (Array.isArray(value)) {
      return [key, value.join(',')];
    }

    if (value === undefined || value === null) {
      return [key, ''];
    }

    return [key, String(value)];
  });

  return Object.fromEntries(normalizedEntries);
}

function parseErrorCodes(input: unknown): number[] {
  if (!Array.isArray(input)) {
    return [500];
  }

  const validCodes = input.filter(
    (code): code is number =>
      typeof code === 'number' && Number.isInteger(code) && code >= 100 && code <= 599
  );

  return validCodes.length > 0 ? validCodes : [500];
}

function pickRandom<T>(items: T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? items[0];
}

async function resolveMockRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectSlug = req.params.projectSlug;

    if (!projectSlug) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const wildcardPath = req.params.mockPath;
    const normalizedPath = Array.isArray(wildcardPath) ? wildcardPath.join('/') : wildcardPath;
    const requestedPath = typeof normalizedPath === 'string' ? `/${normalizedPath}` : '/';
    const method = req.method.toUpperCase();

    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: {
        id: true,
        globalConfig: true,
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const endpoint = await prisma.endpoint.findFirst({
      where: {
        projectId: project.id,
        method,
        path: requestedPath,
      },
      include: {
        endpointConfig: true,
        scenarios: true,
      },
    });

    if (!endpoint) {
      res.status(404).json({ error: 'Endpoint not found' });
      return;
    }

    const endpointLatencyConfig = endpoint.endpointConfig
      ? {
          latencyMode: endpoint.endpointConfig.latencyMode,
          fixedDelayMs: endpoint.endpointConfig.fixedDelayMs,
          minDelayMs: endpoint.endpointConfig.minDelayMs,
          maxDelayMs: endpoint.endpointConfig.maxDelayMs,
        }
      : null;

    const globalLatencyConfig = project.globalConfig
      ? {
          latencyEnabled: project.globalConfig.latencyEnabled,
          latencyMode: project.globalConfig.latencyMode,
          latencyMinMs: project.globalConfig.latencyMinMs,
          latencyMaxMs: project.globalConfig.latencyMaxMs,
          scope: project.globalConfig.scope,
        }
      : null;

    const shouldForceError =
      project.globalConfig?.errorSimulationEnabled === true &&
      Math.random() < project.globalConfig.errorSimulationRate;

    if (shouldForceError) {
      const forcedLatencyMs = calculateLatency(0, endpointLatencyConfig, globalLatencyConfig);
      const forcedCodes = parseErrorCodes(project.globalConfig?.errorSimulationCodes);
      const forcedStatusCode = pickRandom(forcedCodes);
      const forcedBody = {};
      const responseHeaders = {
        'X-Simulador-Scenario': 'forced-error',
        'X-Simulador-Latency': String(forcedLatencyMs),
        'Content-Type': 'application/json',
      };

      await applyLatency(forcedLatencyMs);

      res.setHeader('X-Simulador-Scenario', responseHeaders['X-Simulador-Scenario']);
      res.setHeader('X-Simulador-Latency', responseHeaders['X-Simulador-Latency']);
      res.setHeader('Content-Type', responseHeaders['Content-Type']);
      res.status(forcedStatusCode).json(forcedBody);

      logRequest({
        projectId: project.id,
        method,
        path: requestedPath,
        fullUrl: req.originalUrl,
        statusCode: forcedStatusCode,
        latencyMs: forcedLatencyMs,
        scenarioType: 'forced-error',
        scenarioSelectionSource: 'forced-error',
        requestHeaders: toStringHeaders(req.headers as Record<string, unknown>),
        requestBody: req.body ?? null,
        responseHeaders,
        responseBody: forcedBody,
      }).catch(() => {});

      return;
    }

    const selectedScenario = selectScenario(
      endpoint.scenarios.map((scenario) => ({
        name: scenario.name,
        type: scenario.type,
        statusCode: scenario.statusCode,
        body: scenario.body,
        delayMs: scenario.delayMs,
        weight: scenario.weight,
      })),
      endpoint.endpointConfig?.useScenarioWeights ?? true
    );

    const scenarioSelectionSource = selectedScenario
      ? (endpoint.endpointConfig?.useScenarioWeights ?? true)
        ? 'weighted-random'
        : 'uniform-random'
      : 'direct-endpoint';

    const latencyMs = calculateLatency(
      selectedScenario?.delayMs ?? 0,
      endpointLatencyConfig,
      globalLatencyConfig
    );

    if (selectedScenario?.type === 'timeout') {
      await applyLatency(Math.max(latencyMs, 30_000));

      logRequest({
        projectId: project.id,
        method,
        path: requestedPath,
        fullUrl: req.originalUrl,
        statusCode: selectedScenario.statusCode,
        latencyMs: Math.max(latencyMs, 30_000),
        scenarioType: selectedScenario.type,
        scenarioSelectionSource,
        requestHeaders: toStringHeaders(req.headers as Record<string, unknown>),
        requestBody: req.body ?? null,
        responseHeaders: {},
        responseBody: selectedScenario.body,
      }).catch(() => {});

      req.socket.destroy();
      return;
    }

    await applyLatency(latencyMs);

    const statusCode = selectedScenario?.statusCode ?? endpoint.statusCode;
    const responseBody = selectedScenario?.body ?? endpoint.responseBody;
    const scenarioName = selectedScenario?.name ?? 'direct';
    const scenarioType = selectedScenario?.type ?? 'default';

    const responseHeaders = {
      'X-Simulador-Scenario': scenarioName,
      'X-Simulador-Latency': String(latencyMs),
      'Content-Type': 'application/json',
    };

    res.setHeader('X-Simulador-Scenario', responseHeaders['X-Simulador-Scenario']);
    res.setHeader('X-Simulador-Latency', responseHeaders['X-Simulador-Latency']);
    res.setHeader('Content-Type', responseHeaders['Content-Type']);
    res.status(statusCode).json(responseBody);

    logRequest({
      projectId: project.id,
      method,
      path: requestedPath,
      fullUrl: req.originalUrl,
      statusCode,
      latencyMs,
      scenarioType,
      scenarioSelectionSource,
      requestHeaders: toStringHeaders(req.headers as Record<string, unknown>),
      requestBody: req.body ?? null,
      responseHeaders,
      responseBody,
    }).catch(() => {});
  } catch (error) {
    next(error);
  }
}

mockRouter.all('/:projectSlug', resolveMockRequest);
mockRouter.all('/:projectSlug/*mockPath', resolveMockRequest);
