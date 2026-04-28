import type { ApiLogEntry } from '../models/api-log.model';

type LegacyApiLogEntry = Omit<
  ApiLogEntry,
  'origin' | 'scenarioName' | 'hasScenario' | 'createdAt' | 'scenarioSelectionSource'
> & {
  scenarioSelectionSource: ApiLogEntry['scenarioSelectionSource'] | 'default' | 'weighted' | 'alternate';
};

const ECOMMERCE_BASE = 'https://mock.api.simulator/ecommerce';
const AUTH_BASE = 'https://mock.api.simulator/auth';
const PAYMENTS_BASE = 'https://mock.api.simulator/payments';

const MOCK_API_LOGS_ECOMMERCE: LegacyApiLogEntry[] = [
  {
    id: 'eco-1',
    method: 'GET',
    path: '/users',
    fullUrl: `${ECOMMERCE_BASE}/users`,
    statusCode: 200,
    latencyMs: 120,
    scenario: 'success',
    scenarioSelectionSource: 'default',
    timeLabel: '14:32:10',
    requestHeaders: { Accept: 'application/json' },
    requestBody: null,
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: {
      data: [
        { id: 'usr_1', name: 'Ada', email: 'ada@example.com' },
        { id: 'usr_2', name: 'Grace', email: 'grace@example.com' },
      ],
    },
  },
  {
    id: 'eco-2',
    method: 'POST',
    path: '/users',
    fullUrl: `${ECOMMERCE_BASE}/users`,
    statusCode: 201,
    latencyMs: 86,
    scenario: 'success',
    scenarioSelectionSource: 'default',
    timeLabel: '14:31:44',
    requestHeaders: { 'Content-Type': 'application/json', Accept: 'application/json' },
    requestBody: { name: 'New user', email: 'new@example.com' },
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: {
      data: { id: 'usr_new123', name: 'New user', email: 'new@example.com', role: 'user' },
    },
  },
  {
    id: 'eco-3',
    method: 'DELETE',
    path: '/users/:id',
    fullUrl: `${ECOMMERCE_BASE}/users/usr_2`,
    statusCode: 204,
    latencyMs: 62,
    scenario: 'success',
    scenarioSelectionSource: 'default',
    timeLabel: '14:28:51',
    requestHeaders: { Accept: 'application/json' },
    requestBody: null,
    responseHeaders: {},
    responseBody: null,
  },
  {
    id: 'eco-4',
    method: 'PUT',
    path: '/orders',
    fullUrl: `${ECOMMERCE_BASE}/orders`,
    statusCode: 500,
    latencyMs: 210,
    scenario: 'error',
    scenarioSelectionSource: 'weighted',
    timeLabel: '14:27:18',
    requestHeaders: { 'Content-Type': 'application/json' },
    requestBody: { orderId: 'ord_1', status: 'paid' },
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: { error: 'Internal error', requestId: 'req_8f2a' },
  },
  {
    id: 'eco-5',
    method: 'GET',
    path: '/orders',
    fullUrl: `${ECOMMERCE_BASE}/orders`,
    statusCode: 200,
    latencyMs: 95,
    scenario: 'empty',
    scenarioSelectionSource: 'alternate',
    timeLabel: '14:26:03',
    requestHeaders: { Accept: 'application/json' },
    requestBody: null,
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: { orders: [] },
  },
];

const MOCK_API_LOGS_AUTH: LegacyApiLogEntry[] = [
  {
    id: 'auth-1',
    method: 'POST',
    path: '/auth/login',
    fullUrl: `${AUTH_BASE}/auth/login`,
    statusCode: 200,
    latencyMs: 180,
    scenario: 'success',
    scenarioSelectionSource: 'default',
    timeLabel: '09:14:22',
    requestHeaders: { 'Content-Type': 'application/json' },
    requestBody: { email: 'dev@example.com', password: '••••••••' },
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: {
      accessToken: 'eyJhbG…',
      refreshToken: 'rt_8f3…',
      expiresIn: 3600,
    },
  },
  {
    id: 'auth-2',
    method: 'POST',
    path: '/auth/refresh',
    fullUrl: `${AUTH_BASE}/auth/refresh`,
    statusCode: 200,
    latencyMs: 95,
    scenario: 'success',
    scenarioSelectionSource: 'default',
    timeLabel: '09:13:01',
    requestHeaders: { 'Content-Type': 'application/json' },
    requestBody: { refreshToken: 'rt_8f3…' },
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: { accessToken: 'eyJhbG…', expiresIn: 3600 },
  },
  {
    id: 'auth-3',
    method: 'GET',
    path: '/auth/me',
    fullUrl: `${AUTH_BASE}/auth/me`,
    statusCode: 401,
    latencyMs: 38,
    scenario: 'error',
    scenarioSelectionSource: 'weighted',
    timeLabel: '09:12:40',
    requestHeaders: { Accept: 'application/json' },
    requestBody: null,
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: { error: 'Unauthorized', code: 'INVALID_TOKEN' },
  },
  {
    id: 'auth-4',
    method: 'GET',
    path: '/auth/me',
    fullUrl: `${AUTH_BASE}/auth/me`,
    statusCode: 200,
    latencyMs: 45,
    scenario: 'success',
    scenarioSelectionSource: 'default',
    timeLabel: '09:11:55',
    requestHeaders: { Accept: 'application/json', Authorization: 'Bearer eyJ…' },
    requestBody: null,
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: { id: 'usr_1', email: 'dev@example.com', name: 'Dev User' },
  },
];

const MOCK_API_LOGS_PAYMENTS: LegacyApiLogEntry[] = [
  {
    id: 'pay-1',
    method: 'GET',
    path: '/payments',
    fullUrl: `${PAYMENTS_BASE}/payments`,
    statusCode: 200,
    latencyMs: 110,
    scenario: 'success',
    scenarioSelectionSource: 'default',
    timeLabel: '16:02:33',
    requestHeaders: { Accept: 'application/json' },
    requestBody: null,
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: { data: [{ id: 'pay_1', amount: 1999, currency: 'usd' }] },
  },
  {
    id: 'pay-2',
    method: 'POST',
    path: '/payments/intents',
    fullUrl: `${PAYMENTS_BASE}/payments/intents`,
    statusCode: 201,
    latencyMs: 220,
    scenario: 'success',
    scenarioSelectionSource: 'default',
    timeLabel: '16:01:08',
    requestHeaders: { 'Content-Type': 'application/json' },
    requestBody: { amount: 4999, currency: 'usd' },
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: {
      id: 'pi_3abc',
      clientSecret: 'pi_3abc_secret_xyz',
      status: 'requires_confirmation',
    },
  },
  {
    id: 'pay-3',
    method: 'POST',
    path: '/payments/intents',
    fullUrl: `${PAYMENTS_BASE}/payments/intents`,
    statusCode: 402,
    latencyMs: 178,
    scenario: 'error',
    scenarioSelectionSource: 'alternate',
    timeLabel: '15:58:12',
    requestHeaders: { 'Content-Type': 'application/json' },
    requestBody: { amount: 50, currency: 'usd' },
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: { error: 'card_declined', declineCode: 'insufficient_funds' },
  },
];

const BY_PROJECT: Record<string, LegacyApiLogEntry[]> = {
  ecommerce: MOCK_API_LOGS_ECOMMERCE,
  auth: MOCK_API_LOGS_AUTH,
  payments: MOCK_API_LOGS_PAYMENTS,
};

/** Mock request log lines aligned with `MOCK_DASHBOARD_PROJECTS` ids and base URLs. */
export function mockApiLogsForProject(projectId: string): ApiLogEntry[] {
  return (BY_PROJECT[projectId] ?? MOCK_API_LOGS_ECOMMERCE) as ApiLogEntry[];
}
