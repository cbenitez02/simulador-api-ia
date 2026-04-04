import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { aiGeneratedEndpointSchema, type AiGeneratedEndpointInput } from './schema.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

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

async function assertProjectExists(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return text.trim();
}

async function createAiCompletion(prompt: string): Promise<AiGeneratedEndpointInput> {
  const completionPromise = openai.chat.completions.create({
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
      reject(new AppError(504, 'AI service timeout'));
    }, 30_000);
  });

  const completion = await Promise.race([completionPromise, timeoutPromise]);
  const rawContent = completion.choices[0]?.message?.content;

  if (!rawContent) {
    throw new AiShapeValidationError('AI returned empty content');
  }

  const parsedJson = JSON.parse(extractJson(rawContent));
  const parsed = aiGeneratedEndpointSchema.safeParse(parsedJson);

  if (!parsed.success) {
    throw new AiShapeValidationError(parsed.error.message);
  }

  return parsed.data;
}

async function persistGeneratedEndpoint(projectId: string, generated: AiGeneratedEndpointInput) {
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
        responseBody: generated.responseBody,
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
        body: scenario.body,
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

export async function generateEndpointWithAi(projectId: string, prompt: string) {
  await assertProjectExists(projectId);

  let lastValidationError: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const generated = await createAiCompletion(prompt);
      return await persistGeneratedEndpoint(projectId, generated);
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

      if (attempt === 1) {
        throw new AppError(422, 'AI could not generate valid endpoint');
      }
    }
  }

  throw new AppError(
    422,
    lastValidationError
      ? `AI could not generate valid endpoint: ${lastValidationError}`
      : 'AI could not generate valid endpoint'
  );
}
