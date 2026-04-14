import { authorizeProjectAccess } from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { toPrismaJson } from '../../lib/prisma-json.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { normalizeAiDraft } from './normalize-draft.js';
import {
  aiNormalizedDraftSchema,
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

function createAiMissingConfigError(): AppError {
  return new AppError(503, 'AI is unavailable right now', {
    code: AI_MISSING_CONFIG_CODE,
    retryable: false,
    details: 'OPENAI_API_KEY is not configured',
  });
}

function getOpenAiClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw createAiMissingConfigError();
  }

  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
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

async function createAiCompletion(prompt: string): Promise<AiRawGeneratedEndpointInput> {
  const completionPromise = getOpenAiClient().chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(createAiTimeoutError());
    }, 30_000);
  });

  let completion;

  try {
    completion = await Promise.race([completionPromise, timeoutPromise]);
  } catch (error) {
    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;

    if (error instanceof AppError) {
      throw error;
    }

    if (errorCode === 'ETIMEDOUT') {
      throw createAiTimeoutError();
    }

    throw createAiUnavailableError();
  }

  const rawContent = completion.choices[0]?.message?.content;

  if (!rawContent) {
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

async function generateNormalizedDraft(prompt: string): Promise<AiPreviewResponseInput> {
  let lastValidationError: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const generated = await createAiCompletion(prompt);
      return normalizeAiDraft(generated);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof AiShapeValidationError) {
        lastValidationError = error.message;

        if (attempt === 1) {
          break;
        }

        continue;
      }

      throw createAiUnavailableError();
    }
  }

  void lastValidationError;
  throw createAiInvalidOutputError();
}

export async function generateEndpointPreview(
  actor: AuthenticatedActor,
  projectId: string,
  prompt: string
) {
  await authorizeProjectAccess(actor, projectId, 'mutate');

  return generateNormalizedDraft(prompt);
}

export async function generateEndpointWithAi(
  actor: AuthenticatedActor,
  projectId: string,
  prompt: string
) {
  await authorizeProjectAccess(actor, projectId, 'mutate');

  const previewDraft = await generateNormalizedDraft(prompt);
  return persistGeneratedEndpoint(projectId, toPersistedDraft(previewDraft));
}
