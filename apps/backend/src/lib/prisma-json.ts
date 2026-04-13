import { DbNull, JsonNull } from '@prisma/client/runtime/client';
import type { Prisma } from '../generated/prisma/client.js';

export type PrismaJsonValue = Prisma.InputJsonValue | Prisma.JsonNullValueInput;
export type PrismaNullableJsonValue = Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toPrismaJson(value: unknown): PrismaJsonValue {
  if (value === null) {
    return JsonNull as unknown as PrismaJsonValue;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toPrismaJson(item)) as PrismaJsonValue;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toPrismaJson(item)])
    ) as PrismaJsonValue;
  }

  return JSON.parse(JSON.stringify(value ?? null)) as PrismaJsonValue;
}

export function toNullablePrismaJson(value: unknown): PrismaNullableJsonValue {
  if (value === null || value === undefined) {
    return DbNull as unknown as PrismaNullableJsonValue;
  }

  return toPrismaJson(value);
}
