import { prisma } from '../lib/prisma.js';
import { toNullablePrismaJson, toPrismaJson } from '../lib/prisma-json.js';

export type MockLogOrigin = 'mock' | 'forced-error';
export type MockLogScenarioType =
  | 'success'
  | 'error'
  | 'timeout'
  | 'empty'
  | 'unauthorized'
  | 'forced-error'
  | 'default'
  | 'rate-limit-block';
export type MockLogScenarioSelectionSource =
  | 'weighted-random'
  | 'uniform-random'
  | 'direct-endpoint'
  | 'forced-error'
  | 'rate-limit';

export interface MockLogInput {
  projectId: string;
  method: string;
  path: string;
  fullUrl: string;
  origin: MockLogOrigin;
  statusCode: number;
  latencyMs: number;
  scenarioType: MockLogScenarioType;
  scenarioSelectionSource: MockLogScenarioSelectionSource;
  scenarioName: string | null;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
}

export type LoggingLevel = 'basic' | 'full' | 'off';

function toLoggedRequestBody(input: MockLogInput, loggingLevel: LoggingLevel) {
  return loggingLevel === 'full'
    ? toNullablePrismaJson(input.requestBody)
    : toNullablePrismaJson(null);
}

function toLoggedResponseBody(input: MockLogInput, loggingLevel: LoggingLevel) {
  return loggingLevel === 'full' ? toPrismaJson(input.responseBody) : {};
}

export async function logRequest(input: MockLogInput, loggingLevel: LoggingLevel): Promise<void> {
  if (loggingLevel === 'off') {
    return;
  }

  await prisma.apiLog.create({
    data: {
      projectId: input.projectId,
      method: input.method,
      path: input.path,
      fullUrl: input.fullUrl,
      origin: input.origin,
      statusCode: input.statusCode,
      latencyMs: input.latencyMs,
      scenarioType: input.scenarioType,
      scenarioSelectionSource: input.scenarioSelectionSource,
      scenarioName: input.scenarioName,
      requestHeaders: input.requestHeaders,
      requestBody: toLoggedRequestBody(input, loggingLevel),
      responseHeaders: input.responseHeaders,
      responseBody: toLoggedResponseBody(input, loggingLevel),
    },
  });
}
