import { prisma } from '../lib/prisma.js';
import { toNullablePrismaJson, toPrismaJson } from '../lib/prisma-json.js';

export interface MockLogInput {
  projectId: string;
  method: string;
  path: string;
  fullUrl: string;
  origin: 'mock' | 'forced-error';
  statusCode: number;
  latencyMs: number;
  scenarioType: string;
  scenarioSelectionSource: string;
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
