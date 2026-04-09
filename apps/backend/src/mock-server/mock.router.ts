import { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { applyLatency, calculateLatency } from './latency.js';
import { logRequest, type LoggingLevel, type MockLogInput } from './logger.js';
import { createRuntimeRateLimiter } from './rate-limit.js';
import { selectScenario } from './scenario-selector.js';

export const mockRouter = Router();
const runtimeRateLimiter = createRuntimeRateLimiter();

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

function setHeaders(res: Response, headers: Record<string, string>): void {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
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
  if (items.length === 0) {
    throw new Error('pickRandom requires at least one item');
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index] as T;
}

function resolveLoggingLevel(level: string | null | undefined): LoggingLevel {
  return level === 'off' || level === 'full' ? level : 'basic';
}

function toAbsoluteUrl(req: Request): string {
  const host = req.get('host');
  const base = host ? `${req.protocol}://${host}` : 'http://localhost';
  return new URL(req.originalUrl, base).toString();
}

function toMockScenarioType(value: string | null | undefined): MockLogInput['scenarioType'] {
  return value === 'success' || value === 'error' || value === 'timeout' || value === 'empty'
    ? value
    : 'default';
}

async function resolveMockRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectSlugParam = req.params.projectSlug;
    const projectSlug = Array.isArray(projectSlugParam) ? projectSlugParam[0] : projectSlugParam;

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
      include: { globalConfig: true },
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
        }
      : null;

    const shouldForceError =
      project.globalConfig?.errorSimulationEnabled === true &&
      Math.random() < project.globalConfig.errorSimulationRate;
    const loggingLevel = resolveLoggingLevel(project.globalConfig?.loggingLevel);
    const fullUrl = toAbsoluteUrl(req);
    const isRateLimitEnabled = project.globalConfig?.rateLimitingEnabled === true;
    const rateLimitResult = isRateLimitEnabled
      ? runtimeRateLimiter.evaluate(project.id, project.globalConfig?.rateLimitingRpm ?? 60)
      : null;

    if (rateLimitResult && !rateLimitResult.allowed) {
      const responseBody = { error: 'Rate limit exceeded' };
      const responseHeaders = {
        ...rateLimitResult.headers,
        'Retry-After': String(rateLimitResult.retryAfterSeconds),
        'Content-Type': 'application/json',
      };

      setHeaders(res, responseHeaders);
      res.status(429).json(responseBody);

      logRequest(
        {
          projectId: project.id,
          method,
          path: requestedPath,
          fullUrl,
          origin: 'mock',
          statusCode: 429,
          latencyMs: 0,
          scenarioType: 'rate-limit-block',
          scenarioSelectionSource: 'rate-limit',
          scenarioName: null,
          requestHeaders: toStringHeaders(req.headers as Record<string, unknown>),
          requestBody: req.body ?? null,
          responseHeaders,
          responseBody,
        },
        loggingLevel
      ).catch(() => {});

      return;
    }

    if (shouldForceError) {
      const forcedLatencyMs = calculateLatency(0, endpointLatencyConfig, globalLatencyConfig);
      const forcedCodes = parseErrorCodes(project.globalConfig?.errorSimulationCodes);
      const forcedStatusCode = pickRandom(forcedCodes);
      const forcedBody = {};
      const responseHeaders = {
        ...(rateLimitResult?.headers ?? {}),
        'X-Simulador-Scenario': 'forced-error',
        'X-Simulador-Latency': String(forcedLatencyMs),
        'Content-Type': 'application/json',
      };

      await applyLatency(forcedLatencyMs);

      setHeaders(res, responseHeaders);
      res.status(forcedStatusCode).json(forcedBody);

      logRequest(
        {
          projectId: project.id,
          method,
          path: requestedPath,
          fullUrl,
          origin: 'forced-error',
          statusCode: forcedStatusCode,
          latencyMs: forcedLatencyMs,
          scenarioType: 'forced-error',
          scenarioSelectionSource: 'forced-error',
          scenarioName: null,
          requestHeaders: toStringHeaders(req.headers as Record<string, unknown>),
          requestBody: req.body ?? null,
          responseHeaders,
          responseBody: forcedBody,
        },
        loggingLevel
      ).catch(() => {});

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

      logRequest(
        {
          projectId: project.id,
          method,
          path: requestedPath,
          fullUrl,
          origin: 'mock',
          statusCode: selectedScenario.statusCode,
          latencyMs: Math.max(latencyMs, 30_000),
          scenarioType: selectedScenario.type,
          scenarioSelectionSource,
          scenarioName: selectedScenario.name,
          requestHeaders: toStringHeaders(req.headers as Record<string, unknown>),
          requestBody: req.body ?? null,
          responseHeaders: {},
          responseBody: selectedScenario.body,
        },
        loggingLevel
      ).catch(() => {});

      req.socket.destroy();
      return;
    }

    await applyLatency(latencyMs);

    const statusCode = selectedScenario?.statusCode ?? endpoint.statusCode;
    const responseBody = selectedScenario?.body ?? endpoint.responseBody;
    const scenarioName = selectedScenario?.name ?? null;
    const scenarioHeader = scenarioName ?? 'direct';
    const scenarioType = toMockScenarioType(selectedScenario?.type);

    const responseHeaders = {
      ...(rateLimitResult?.headers ?? {}),
      'X-Simulador-Scenario': scenarioHeader,
      'X-Simulador-Latency': String(latencyMs),
      'Content-Type': 'application/json',
    };

    setHeaders(res, responseHeaders);
    res.status(statusCode).json(responseBody);

    logRequest(
      {
        projectId: project.id,
        method,
        path: requestedPath,
        fullUrl,
        origin: 'mock',
        statusCode,
        latencyMs,
        scenarioType,
        scenarioSelectionSource,
        scenarioName,
        requestHeaders: toStringHeaders(req.headers as Record<string, unknown>),
        requestBody: req.body ?? null,
        responseHeaders,
        responseBody,
      },
      loggingLevel
    ).catch(() => {});
  } catch (error) {
    next(error);
  }
}

mockRouter.all('/:projectSlug', resolveMockRequest);
mockRouter.all('/:projectSlug/*mockPath', resolveMockRequest);
