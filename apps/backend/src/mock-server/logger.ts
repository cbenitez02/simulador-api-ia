import { prisma } from '../lib/prisma.js';
import { toNullablePrismaJson, toPrismaJson } from '../lib/prisma-json.js';

export interface MockLogInput {
  projectId: string;
  method: string;
  path: string;
  fullUrl: string;
  statusCode: number;
  latencyMs: number;
  scenarioType: string;
  scenarioSelectionSource: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
}

export async function logRequest(input: MockLogInput): Promise<void> {
  await prisma.apiLog.create({
    data: {
      projectId: input.projectId,
      method: input.method,
      path: input.path,
      fullUrl: input.fullUrl,
      statusCode: input.statusCode,
      latencyMs: input.latencyMs,
      scenarioType: input.scenarioType,
      scenarioSelectionSource: input.scenarioSelectionSource,
      requestHeaders: input.requestHeaders,
      requestBody: toNullablePrismaJson(input.requestBody),
      responseHeaders: input.responseHeaders,
      responseBody: toPrismaJson(input.responseBody),
    },
  });
}
