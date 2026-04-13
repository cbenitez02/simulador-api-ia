import type { CorsOptions } from 'cors';
import type { Env } from './env.js';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1']);

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return LOCALHOST_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function buildAllowedOriginSet(origins: string[] | undefined): Set<string> {
  return new Set(origins?.map((origin) => origin.replace(/\/$/, '')) ?? []);
}

export function isAllowedCorsOrigin(origin: string | undefined, env: Env): boolean {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = origin.replace(/\/$/, '');
  const configuredOrigins = buildAllowedOriginSet(env.CORS_ALLOWED_ORIGINS);

  if (configuredOrigins.size > 0) {
    return configuredOrigins.has(normalizedOrigin);
  }

  if (env.NODE_ENV === 'production') {
    return false;
  }

  return isLocalDevelopmentOrigin(normalizedOrigin);
}

export function createCorsOptions(env: Env): CorsOptions {
  return {
    origin(origin, callback) {
      callback(null, isAllowedCorsOrigin(origin, env));
    },
    optionsSuccessStatus: 204,
  };
}
