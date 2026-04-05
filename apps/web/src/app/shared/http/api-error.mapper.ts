export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function mapApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (hasStatus(error)) {
    const payload = error.error;
    return new ApiError(
      error.status,
      extractMessage(payload) ?? error.message ?? 'Request failed',
      extractDetails(payload),
    );
  }

  if (error instanceof Error) {
    return new ApiError(0, error.message);
  }

  return new ApiError(0, 'Unexpected request error');
}

function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'status' in value && 'message' in value;
}

function hasStatus(value: unknown): value is {
  status: number;
  message?: string;
  error?: unknown;
} {
  return typeof value === 'object' && value !== null && 'status' in value;
}

function extractMessage(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (typeof payload !== 'object' || payload === null) return null;
  if ('error' in payload && typeof payload.error === 'string') return payload.error;
  if ('message' in payload && typeof payload.message === 'string') return payload.message;
  return null;
}

function extractDetails(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) return undefined;
  if ('details' in payload) return payload.details;
  if ('fields' in payload) return payload.fields;
  return undefined;
}
