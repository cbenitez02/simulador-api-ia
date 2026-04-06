import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';

export function provideApiConfig(baseUrl = DEFAULT_API_BASE_URL): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: API_BASE_URL, useValue: baseUrl.replace(/\/$/, '') }]);
}
