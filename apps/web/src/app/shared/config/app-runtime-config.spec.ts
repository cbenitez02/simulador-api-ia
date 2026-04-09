import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_API_BASE_URL, DEFAULT_MOCK_BASE_URL, getAppRuntimeConfig } from './app-runtime-config';

type RuntimeConfigGlobal = typeof globalThis & {
  __SIMULADOR_RUNTIME_CONFIG__?: {
    apiBaseUrl?: string;
    mockBaseUrl?: string;
  };
};

const runtimeConfigGlobal = globalThis as RuntimeConfigGlobal;

describe('app-runtime-config', () => {
  afterEach(() => {
    delete runtimeConfigGlobal.__SIMULADOR_RUNTIME_CONFIG__;
  });

  it('keeps the localhost defaults when no runtime overrides are present', () => {
    expect(getAppRuntimeConfig()).toEqual({
      apiBaseUrl: DEFAULT_API_BASE_URL,
      mockBaseUrl: DEFAULT_MOCK_BASE_URL,
    });
  });

  it('resolves both URLs from runtime overrides', () => {
    runtimeConfigGlobal.__SIMULADOR_RUNTIME_CONFIG__ = {
      apiBaseUrl: 'https://api.example.com/api/v1/',
      mockBaseUrl: 'https://mock.example.com/base/',
    };

    expect(getAppRuntimeConfig()).toEqual({
      apiBaseUrl: 'https://api.example.com/api/v1',
      mockBaseUrl: 'https://mock.example.com/base',
    });
  });

  it('derives the mock base from the configured API base when only one override is provided', () => {
    runtimeConfigGlobal.__SIMULADOR_RUNTIME_CONFIG__ = {
      apiBaseUrl: 'https://deploy.example.com/backend/api/v1/',
    };

    expect(getAppRuntimeConfig()).toEqual({
      apiBaseUrl: 'https://deploy.example.com/backend/api/v1',
      mockBaseUrl: 'https://deploy.example.com/backend/mock',
    });
  });
});
