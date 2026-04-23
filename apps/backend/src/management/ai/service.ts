import type { AuthenticatedActor } from '../../auth/types.js';
import type { Env } from '../../config/env.js';
import { toPrismaJson } from '../../lib/prisma-json.js';
import { AppError } from '../../middleware/error-handler.js';
import { normalizeAiDraft } from './normalize-draft.js';
import { AiProviderExecutionError, resolveAiProviderChain, type AiProvider } from './provider.js';
import { createCompatAiProvider } from './providers/compat.js';
import { createOpenAiProvider } from './providers/openai.js';
import {
  aiNormalizedDraftSchema,
  aiPreviewResponseSchema,
  aiRawGeneratedEndpointSchema,
  type AiNormalizedDraftInput,
  type AiPreviewResponseInput,
  type AiRawGeneratedEndpointInput,
} from './schema.js';

const SYSTEM_PROMPT = `You generate API endpoint mocks.
Return ONLY valid JSON.

Schema:
{
  "method": "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
  "path": "/resource/path",
  "description": "short description",
  "statusCode": 200,
  "responseBody": {"any":"json"},
  "scenarios": [
    {
      "name": "scenario name",
      "type": "success|error|edge-case|timeout|empty",
      "statusCode": 200,
      "body": {"any":"json"},
      "delayMs": 0,
      "weight": 1
    }
  ]
}

Rules:
- path must start with '/'
- scenarios must include at least one success and one error scenario
- do not include markdown or explanations, only raw JSON`;

class AiShapeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiShapeValidationError';
  }
}

const AI_TIMEOUT_CODE = 'AI_TIMEOUT';
const AI_UNAVAILABLE_CODE = 'AI_UNAVAILABLE';
const AI_INVALID_OUTPUT_CODE = 'AI_INVALID_OUTPUT';
const AI_MISSING_CONFIG_CODE = 'AI_UNAVAILABLE';
const AI_PREVIEW_CACHE_TTL_MS = 5 * 60_000;
const AI_PREVIEW_CACHE_MAX_ENTRIES = 100;

interface PreviewCacheEntry {
  value: AiPreviewResponseInput;
  expiresAtMs: number;
}

interface AiPreviewRuntimeOptions {
  providers?: AiProvider[];
  nowMs?: number;
}

const previewCache = new Map<string, PreviewCacheEntry>();

function clonePreviewValue(value: AiPreviewResponseInput): AiPreviewResponseInput {
  return aiPreviewResponseSchema.parse(structuredClone(value));
}

function normalizePreviewCachePrompt(prompt: string): string {
  return prompt.trim();
}

function buildPreviewCacheKey(projectId: string, prompt: string): string {
  return `${projectId}:${normalizePreviewCachePrompt(prompt)}`;
}

function pruneExpiredPreviewCacheEntries(nowMs: number): void {
  for (const [key, entry] of previewCache.entries()) {
    if (entry.expiresAtMs <= nowMs) {
      previewCache.delete(key);
    }
  }
}

function evictPreviewCacheEntriesIfNeeded(): void {
  while (previewCache.size >= AI_PREVIEW_CACHE_MAX_ENTRIES) {
    const oldestKey = previewCache.keys().next().value;

    if (!oldestKey) {
      return;
    }

    previewCache.delete(oldestKey);
  }
}

function readPreviewCache(
  projectId: string,
  prompt: string,
  nowMs: number
): AiPreviewResponseInput | null {
  pruneExpiredPreviewCacheEntries(nowMs);

  const entry = previewCache.get(buildPreviewCacheKey(projectId, prompt));

  if (!entry) {
    return null;
  }

  return clonePreviewValue(entry.value);
}

function writePreviewCache(
  projectId: string,
  prompt: string,
  value: AiPreviewResponseInput,
  nowMs: number
): AiPreviewResponseInput {
  pruneExpiredPreviewCacheEntries(nowMs);
  evictPreviewCacheEntriesIfNeeded();

  const clonedValue = clonePreviewValue(value);

  previewCache.set(buildPreviewCacheKey(projectId, prompt), {
    value: clonedValue,
    expiresAtMs: nowMs + AI_PREVIEW_CACHE_TTL_MS,
  });

  return clonePreviewValue(clonedValue);
}

export function resetAiPreviewCacheForTests(): void {
  previewCache.clear();
}

function createAiTimeoutError(): AppError {
  return new AppError(504, 'AI request timed out', {
    code: AI_TIMEOUT_CODE,
    retryable: true,
  });
}

function createAiUnavailableError(): AppError {
  return new AppError(503, 'AI is unavailable right now', {
    code: AI_UNAVAILABLE_CODE,
    retryable: true,
  });
}

function createAiMissingConfigError(details: string): AppError {
  return new AppError(503, 'AI is unavailable right now', {
    code: AI_MISSING_CONFIG_CODE,
    retryable: false,
    details,
  });
}

function createAiInvalidOutputError(): AppError {
  return new AppError(422, 'AI returned invalid output', {
    code: AI_INVALID_OUTPUT_CODE,
    retryable: true,
  });
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return text.trim();
}

function parseAiCompletion(rawContent: string): AiRawGeneratedEndpointInput {
  if (!rawContent.trim()) {
    throw new AiShapeValidationError('AI returned empty content');
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(extractJson(rawContent));
  } catch {
    throw new AiShapeValidationError('AI returned invalid JSON');
  }

  const parsed = aiRawGeneratedEndpointSchema.safeParse(parsedJson);

  if (!parsed.success) {
    throw new AiShapeValidationError(parsed.error.message);
  }

  return parsed.data;
}

async function getEnv(): Promise<Env> {
  const { env } = await import('../../config/env.js');
  return env;
}

async function buildAiProviders(): Promise<AiProvider[]> {
  const env = await getEnv();

  return resolveAiProviderChain(env).map((providerName) => {
    if (providerName === 'compat') {
      return createCompatAiProvider(env, { systemPrompt: SYSTEM_PROMPT });
    }

    return createOpenAiProvider(env, { systemPrompt: SYSTEM_PROMPT });
  });
}

function mapProviderExecutionError(error: AiProviderExecutionError): AppError {
  if (error.kind === 'timeout') {
    return createAiTimeoutError();
  }

  if (error.kind === 'missing-config') {
    return createAiMissingConfigError(error.details ?? `${error.provider} is not configured`);
  }

  return createAiUnavailableError();
}

async function authorizeAiProjectMutation(actor: AuthenticatedActor, projectId: string) {
  const { authorizeProjectAccess } = await import('../../auth/authorization.js');
  await authorizeProjectAccess(actor, projectId, 'mutate');
}

export async function createNormalizedDraftWithFallback(
  prompt: string,
  providers?: AiProvider[]
): Promise<AiPreviewResponseInput> {
  const activeProviders = providers ?? (await buildAiProviders());

  if (activeProviders.length === 0) {
    throw createAiMissingConfigError('No AI providers are configured');
  }

  let lastExecutionError: AiProviderExecutionError | null = null;

  for (const provider of activeProviders) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const generated = parseAiCompletion(await provider.generateJson(prompt));
        return normalizeAiDraft(generated);
      } catch (error) {
        if (error instanceof AiProviderExecutionError) {
          lastExecutionError = error;
          break;
        }

        if (error instanceof AiShapeValidationError) {
          if (attempt === 1) {
            throw createAiInvalidOutputError();
          }

          continue;
        }

        throw createAiUnavailableError();
      }
    }
  }

  if (lastExecutionError) {
    throw mapProviderExecutionError(lastExecutionError);
  }

  throw createAiUnavailableError();
}

function toPersistedDraft(previewDraft: AiPreviewResponseInput): AiNormalizedDraftInput {
  return aiNormalizedDraftSchema.parse({
    method: previewDraft.method,
    path: previewDraft.path,
    description: previewDraft.description,
    statusCode: previewDraft.statusCode,
    responseBody: previewDraft.responseBody,
    scenarios: previewDraft.scenarios,
  });
}

async function persistGeneratedEndpoint(projectId: string, generated: AiNormalizedDraftInput) {
  const { prisma } = await import('../../lib/prisma.js');

  const duplicate = await prisma.endpoint.findFirst({
    where: {
      projectId,
      method: generated.method,
      path: generated.path,
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppError(409, 'Endpoint already exists for this method and path');
  }

  return prisma.$transaction(async (tx) => {
    const endpoint = await tx.endpoint.create({
      data: {
        projectId,
        method: generated.method,
        path: generated.path,
        description: generated.description,
        statusCode: generated.statusCode,
        responseBody: toPrismaJson(generated.responseBody),
      },
    });

    await tx.endpointConfig.create({
      data: {
        endpointId: endpoint.id,
      },
    });

    await tx.scenario.createMany({
      data: generated.scenarios.map((scenario) => ({
        endpointId: endpoint.id,
        name: scenario.name,
        type: scenario.type,
        statusCode: scenario.statusCode,
        body: toPrismaJson(scenario.body),
        delayMs: scenario.delayMs,
        weight: scenario.weight,
      })),
    });

    return tx.endpoint.findUniqueOrThrow({
      where: { id: endpoint.id },
      include: {
        endpointConfig: true,
        scenarios: true,
      },
    });
  });
}

async function generateNormalizedDraft(
  prompt: string,
  providers?: AiProvider[]
): Promise<AiPreviewResponseInput> {
  return createNormalizedDraftWithFallback(prompt, providers);
}

export async function generateEndpointPreview(
  actor: AuthenticatedActor,
  projectId: string,
  prompt: string,
  runtimeOptions: AiPreviewRuntimeOptions = {}
) {
  await authorizeAiProjectMutation(actor, projectId);

  const nowMs = runtimeOptions.nowMs ?? Date.now();
  const cachedPreview = readPreviewCache(projectId, prompt, nowMs);

  if (cachedPreview) {
    return cachedPreview;
  }

  const preview = await generateNormalizedDraft(prompt, runtimeOptions.providers);
  return writePreviewCache(projectId, prompt, preview, nowMs);
}

export async function generateEndpointWithAi(
  actor: AuthenticatedActor,
  projectId: string,
  prompt: string
) {
  await authorizeAiProjectMutation(actor, projectId);

  const previewDraft = await generateNormalizedDraft(prompt);
  return persistGeneratedEndpoint(projectId, toPersistedDraft(previewDraft));
}

export { AiProviderExecutionError, type AiProvider };
