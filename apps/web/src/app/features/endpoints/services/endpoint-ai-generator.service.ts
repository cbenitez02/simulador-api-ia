import { Injectable } from '@angular/core';
import type { HttpMethod } from '../../../shared/models/endpoint-preview.model';
import type { AiGeneratedEndpointShape, EndpointScenario } from '../models/endpoint-draft.model';
import { newScenarioId } from '../models/endpoint-draft.model';
import { mockAiResponseBody } from '../data/mock-ai-response';
import { statusCodeForMethod } from './endpoint-draft.mapper';

const METHOD_WORDS = /\b(get|post|put|patch|delete)\b/i;
const PATH_IN_PROMPT = /(\/[A-Za-z0-9_{}\-:.]+(?:\/[A-Za-z0-9_{}\-:.]+)*)/;
const ENTITY_ALIASES: ReadonlyArray<{ words: RegExp; path: string }> = [
  { words: /\busers?\b/i, path: '/users' },
  { words: /\borders?\b/i, path: '/orders' },
  { words: /\bproducts?\b/i, path: '/products' },
  { words: /\bitems?\b/i, path: '/items' },
  { words: /\baccounts?\b/i, path: '/accounts' },
  { words: /\bsessions?\b/i, path: '/sessions' },
];

/**
 * Integer weights that sum exactly to `target` (e.g. 100), preserving proportions
 * as well as possible (largest remainder method — avoids round-off drift from `Math.round` per slot).
 */
function distributeIntegerWeights(raw: number[], target: number): number[] {
  const n = raw.length;
  if (n === 0) return [];
  const total = raw.reduce((a, w) => a + w, 0);
  if (total <= 0) {
    const base = Math.floor(target / n);
    const rest = target - base * n;
    return raw.map((_, i) => base + (i < rest ? 1 : 0));
  }

  const exact = raw.map((w) => (w / total) * target);
  const floors = exact.map((e) => Math.floor(e));
  const assigned = floors.reduce((a, w) => a + w, 0);
  const deficit = target - assigned;

  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac || a.i - b.i);

  const out = [...floors];
  for (let k = 0; k < deficit; k++) {
    out[order[k]!.i]++;
  }
  return out;
}

/**
 * Local, deterministic “AI” inference from natural language.
 * Replace with a real API later; keep this interface stable.
 */
@Injectable({ providedIn: 'root' })
export class EndpointAiGeneratorService {
  /**
   * Simulates network latency. Always resolves to a usable payload (fallback on empty prompt).
   */
  generateFromPrompt(prompt: string): Promise<AiGeneratedEndpointShape> {
    const trimmed = prompt.trim();
    const delayMs = 520 + Math.floor(Math.random() * 380);
    return new Promise((resolve) => {
      window.setTimeout(() => {
        resolve(this.infer(trimmed));
      }, delayMs);
    });
  }

  private infer(prompt: string): AiGeneratedEndpointShape {
    const safePrompt = prompt || 'Generic REST resource';
    try {
      const method = this.inferMethod(safePrompt);
      const route = this.inferRoute(safePrompt, method);
      const description = this.inferDescription(safePrompt);
      const responseBody = mockAiResponseBody(method, route);
      const statusCode = statusCodeForMethod(method);
      const scenarios = this.buildDefaultScenarios(method, responseBody, safePrompt);
      return { method, route, description, responseBody, scenarios, statusCode };
    } catch {
      return this.fallbackBundle(safePrompt);
    }
  }

  private inferMethod(text: string): HttpMethod {
    const m = text.match(METHOD_WORDS);
    if (m) {
      const w = m[1]!.toUpperCase();
      if (w === 'GET' || w === 'POST' || w === 'PUT' || w === 'PATCH' || w === 'DELETE') {
        return w;
      }
    }
    const lower = text.toLowerCase();
    if (/\b(create|add|insert|register)\b/.test(lower)) return 'POST';
    if (/\b(delete|remove|destroy)\b/.test(lower)) return 'DELETE';
    if (/\b(update|replace)\b/.test(lower)) return 'PUT';
    if (/\bpatch\b|\bpartial\b|\bmodify\b/.test(lower)) return 'PATCH';
    return 'GET';
  }

  private inferRoute(text: string, method: HttpMethod): string {
    const pathMatch = text.match(PATH_IN_PROMPT);
    if (pathMatch) {
      let p = pathMatch[1]!;
      if (!p.startsWith('/')) p = `/${p}`;
      return p.replace(/\/+$/, '') || '/';
    }
    for (const { words, path } of ENTITY_ALIASES) {
      if (words.test(text)) return path;
    }
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') return '/resource';
    return '/items';
  }

  private inferDescription(text: string): string {
    const oneLine = text.replace(/\s+/g, ' ').trim();
    if (!oneLine) return 'Mock endpoint generated from prompt.';
    return oneLine.length > 160 ? `${oneLine.slice(0, 157)}…` : oneLine;
  }

  private buildDefaultScenarios(method: HttpMethod, successBody: unknown, prompt: string): EndpointScenario[] {
    const lower = prompt.toLowerCase();
    const wantError = /\b(error|fail|invalid|unauthori|forbidden|404|500)\b/.test(lower);
    const wantEmpty = /\b(empty|no data|no results|none)\b/.test(lower);
    const wantTimeout = /\b(timeout|slow|hang)\b/.test(lower);

    const scenarios: EndpointScenario[] = [
      {
        id: newScenarioId(),
        name: 'Success',
        type: 'success',
        statusCode: statusCodeForMethod(method),
        body: successBody,
        delayMs: 0,
        weight: 70,
      },
      {
        id: newScenarioId(),
        name: 'Empty result',
        type: 'empty',
        statusCode: method === 'DELETE' ? 204 : 200,
        body: method === 'DELETE' ? null : { data: [], meta: { total: 0 } },
        delayMs: 0,
        weight: 15,
      },
      {
        id: newScenarioId(),
        name: 'Error',
        type: 'error',
        statusCode: 500,
        body: { error: 'Internal server error', message: 'Simulated failure' },
        delayMs: 0,
        weight: 10,
      },
      {
        id: newScenarioId(),
        name: 'Timeout',
        type: 'timeout',
        statusCode: 408,
        body: { error: 'Request timeout' },
        delayMs: 8000,
        weight: 5,
      },
    ];

    if (!wantEmpty) {
      const idx = scenarios.findIndex((s) => s.type === 'empty');
      if (idx !== -1) scenarios.splice(idx, 1);
    }
    if (!wantError) {
      const idx = scenarios.findIndex((s) => s.type === 'error');
      if (idx !== -1) scenarios.splice(idx, 1);
    }
    if (!wantTimeout) {
      const idx = scenarios.findIndex((s) => s.type === 'timeout');
      if (idx !== -1) scenarios.splice(idx, 1);
    }

    const totalW = scenarios.reduce((a, s) => a + s.weight, 0);
    if (totalW !== 100 && scenarios.length) {
      const normalized = distributeIntegerWeights(
        scenarios.map((s) => s.weight),
        100,
      );
      return scenarios.map((s, i) => ({ ...s, weight: normalized[i]! }));
    }
    return scenarios;
  }

  private fallbackBundle(prompt: string): AiGeneratedEndpointShape {
    const method: HttpMethod = 'GET';
    const route = '/resource';
    const responseBody = mockAiResponseBody(method, route);
    return {
      method,
      route,
      description: prompt.trim() ? this.inferDescription(prompt) : 'Fallback mock endpoint',
      responseBody,
      statusCode: statusCodeForMethod(method),
      scenarios: this.buildDefaultScenarios(method, responseBody, `${prompt} error timeout empty`),
    };
  }
}
