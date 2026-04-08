import { Prisma } from '../generated/prisma/client.js';

type JsonLike = Prisma.InputJsonValue | typeof Prisma.JsonNull;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toPrismaJson(value: unknown): JsonLike {
  if (value === null) {
    return Prisma.JsonNull;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toPrismaJson(item)) as Prisma.InputJsonArray;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toPrismaJson(item)])
    ) as Prisma.InputJsonObject;
  }

  return JSON.parse(JSON.stringify(value ?? null)) as JsonLike;
}

export function toNullablePrismaJson(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.DbNull;
  }

  return toPrismaJson(value) as Prisma.InputJsonValue;
}
