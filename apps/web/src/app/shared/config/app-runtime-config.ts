export interface AppRuntimeConfig {
  apiBaseUrl?: string;
  mockBaseUrl?: string;
  clerkPublishableKey?: string;
}

export interface ResolvedAppRuntimeConfig {
  apiBaseUrl: string;
  mockBaseUrl: string;
  clerkPublishableKey?: string;
}

type RuntimeConfigGlobal = typeof globalThis & {
  __SIMULADOR_RUNTIME_CONFIG__?: AppRuntimeConfig;
};

export const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';
export const DEFAULT_MOCK_BASE_URL = 'http://localhost:3000/mock';

const API_BASE_PATH_SUFFIX = '/api/v1';

function normalizeBaseUrl(value?: string): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return normalized.replace(/\/+$/, '');
}

function readRuntimeConfig(): AppRuntimeConfig {
  return (globalThis as RuntimeConfigGlobal).__SIMULADOR_RUNTIME_CONFIG__ ?? {};
}

function deriveMockBaseUrl(apiBaseUrl: string): string {
  try {
    const url = new URL(apiBaseUrl);
    const normalizedPath = url.pathname.replace(/\/+$/, '');

    url.pathname = normalizedPath.endsWith(API_BASE_PATH_SUFFIX)
      ? `${normalizedPath.slice(0, -API_BASE_PATH_SUFFIX.length) || ''}/mock`
      : `${normalizedPath}/mock`;

    return url.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_MOCK_BASE_URL;
  }
}

export function getAppRuntimeConfig(overrides: AppRuntimeConfig = {}): ResolvedAppRuntimeConfig {
  const runtimeConfig = { ...readRuntimeConfig(), ...overrides };
  const apiBaseUrl = normalizeBaseUrl(runtimeConfig.apiBaseUrl) ?? DEFAULT_API_BASE_URL;
  const mockBaseUrl = normalizeBaseUrl(runtimeConfig.mockBaseUrl) ?? deriveMockBaseUrl(apiBaseUrl);
  const clerkPublishableKey = runtimeConfig.clerkPublishableKey?.trim() || undefined;

  return { apiBaseUrl, mockBaseUrl, clerkPublishableKey };
}

export function getMockBaseUrl(overrides: AppRuntimeConfig = {}): string {
  return getAppRuntimeConfig(overrides).mockBaseUrl;
}
