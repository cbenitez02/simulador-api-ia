import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function isPrismaKnownError(err: unknown): err is { code: string; meta?: { target?: unknown } } {
  if (typeof err !== 'object' || err === null) return false;

  return 'code' in err && typeof (err as { code?: unknown }).code === 'string';
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  void _next;

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation Error',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });

    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (isPrismaKnownError(err) && err.code === 'P2002') {
    res.status(409).json({
      error: 'Resource already exists',
      fields: err.meta?.target,
    });

    return;
  }

  if (isPrismaKnownError(err) && err.code === 'P2025') {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
};
