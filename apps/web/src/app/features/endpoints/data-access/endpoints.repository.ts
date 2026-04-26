import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type {
  AiEndpointPreviewDto,
  CreateScenarioDto,
  EndpointDto,
  EndpointListItemDto,
  PagedResponseDto,
  ScenarioDto,
} from '../../../shared/http/api.types';
import type { EndpointPreview } from '../../../shared/models/endpoint-preview.model';
import type { EndpointDraft, SaveStage } from '../models/endpoint-draft.model';
import {
  mapAiDraftFromApi,
  mapEndpointConfigRequestFromDraft,
  mapEndpointCreateRequestFromDraft,
  mapEndpointDraftFromApi,
  mapEndpointRequestFromDraft,
  mapEndpointSummaryFromApi,
} from '../adapters/endpoint-api.mapper';

type ComparableScenarioPayload = Pick<
  CreateScenarioDto,
  'name' | 'type' | 'statusCode' | 'body' | 'delayMs' | 'weight'
>;

export interface EndpointListQuery {
  limit?: number;
  offset?: number;
  q?: string;
  method?: EndpointPreview['method'];
  sort?: 'path-asc' | 'path-desc' | 'method';
}

export interface PagedEndpointsResult {
  items: EndpointPreview[];
  page: PagedResponseDto<EndpointListItemDto>['page'];
}

export class EndpointSaveError extends Error {
  public readonly stage: SaveStage;
  public readonly endpointId: string | null;
  public readonly partial: boolean;

  public constructor(message: string, stage: SaveStage, endpointId: string | null, partial: boolean) {
    super(message);
    this.name = 'EndpointSaveError';
    this.stage = stage;
    this.endpointId = endpointId;
    this.partial = partial;
  }
}

function toEndpointSaveError(
  error: unknown,
  stage: SaveStage,
  endpointId: string | null,
  partial: boolean,
): EndpointSaveError {
  const message = error instanceof Error ? error.message : 'Could not save endpoint.';
  return new EndpointSaveError(message, stage, endpointId, partial);
}

function buildEndpointListQueryString(query: EndpointListQuery = {}): string {
  const params = new URLSearchParams();

  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.method) params.set('method', query.method);
  if (query.sort) params.set('sort', query.sort);

  const text = params.toString();
  return text ? `?${text}` : '';
}

function mapEndpointListItemFromApi(endpoint: EndpointListItemDto): EndpointPreview {
  return {
    id: endpoint.id,
    method: mapEndpointSummaryFromApi({
      ...endpoint,
    } as EndpointDto).method,
    path: endpoint.path,
    description: endpoint.description || 'No description',
    latencyMs: endpoint.latencyMs,
    statusCode: endpoint.statusCode,
    responseBody: endpoint.responseBody,
    responseHeaders: endpoint.responseHeaders,
  };
}

function sortComparableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortComparableValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortComparableValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}

function buildScenarioPayload(
  scenario: Pick<ScenarioDto, 'name' | 'type' | 'statusCode' | 'body' | 'delayMs' | 'weight'>,
): ComparableScenarioPayload;
function buildScenarioPayload(
  scenario: Pick<EndpointDraft['scenarios'][number], 'name' | 'type' | 'statusCode' | 'body' | 'delayMs' | 'weight'>,
): ComparableScenarioPayload;
function buildScenarioPayload(
  scenario:
    | Pick<ScenarioDto, 'name' | 'type' | 'statusCode' | 'body' | 'delayMs' | 'weight'>
    | Pick<EndpointDraft['scenarios'][number], 'name' | 'type' | 'statusCode' | 'body' | 'delayMs' | 'weight'>,
): ComparableScenarioPayload {
  return {
    name: scenario.name.trim() || 'Scenario',
    type: scenario.type === 'custom' ? 'success' : scenario.type,
    statusCode: scenario.statusCode,
    body: scenario.body,
    delayMs: scenario.delayMs,
    weight: Math.max(1, scenario.weight),
  };
}

function haveSameScenarioPayload(left: ComparableScenarioPayload, right: ComparableScenarioPayload): boolean {
  return JSON.stringify(sortComparableValue(left)) === JSON.stringify(sortComparableValue(right));
}

@Injectable({ providedIn: 'root' })
export class EndpointsRepository {
  private readonly api = inject(ApiClient);

  async previewAiDraft(projectId: string, prompt: string): Promise<EndpointDraft> {
    const draft = await this.api.post<AiEndpointPreviewDto, { prompt: string }>(
      `/projects/${projectId}/endpoints/ai-preview`,
      { prompt },
    );

    return mapAiDraftFromApi(draft);
  }

  async generateAiEndpoint(projectId: string, prompt: string): Promise<EndpointPreview> {
    const endpoint = await this.api.post<EndpointDto, { prompt: string }>(
      `/projects/${projectId}/endpoints/ai-generate`,
      { prompt },
    );

    return mapEndpointSummaryFromApi(endpoint);
  }

  async loadDraft(projectId: string, endpointId: string): Promise<EndpointDraft> {
    const endpoint = await this.api.get<EndpointDto>(`/projects/${projectId}/endpoints/${endpointId}`);
    return mapEndpointDraftFromApi(endpoint);
  }

  async listEndpoints(projectId: string, query: EndpointListQuery = {}): Promise<PagedEndpointsResult> {
    const response = await this.api.get<PagedResponseDto<EndpointListItemDto>>(
      `/projects/${projectId}/endpoints${buildEndpointListQueryString(query)}`,
    );

    return {
      items: response.items.map(mapEndpointListItemFromApi),
      page: response.page,
    };
  }

  async saveEndpoint(projectId: string, draft: EndpointDraft, endpointId?: string | null): Promise<EndpointPreview> {
    let persistedEndpointId = endpointId ?? null;

    const endpoint = await (async () => {
      try {
        return endpointId
          ? await this.api.patch<EndpointDto, ReturnType<typeof mapEndpointRequestFromDraft>>(
              `/projects/${projectId}/endpoints/${endpointId}`,
              mapEndpointRequestFromDraft(draft),
            )
          : await this.api.post<EndpointDto, ReturnType<typeof mapEndpointCreateRequestFromDraft>>(
              `/projects/${projectId}/endpoints`,
              mapEndpointCreateRequestFromDraft(draft),
            );
      } catch (error) {
        throw toEndpointSaveError(error, 'endpoint-core', persistedEndpointId, false);
      }
    })();

    persistedEndpointId = endpoint.id;

    try {
      await this.api.put(`/endpoints/${endpoint.id}/config`, mapEndpointConfigRequestFromDraft(endpoint.id, draft));
    } catch (error) {
      throw toEndpointSaveError(error, 'config', persistedEndpointId, true);
    }

    try {
      await this.reconcileScenarios(endpoint.id, draft);
    } catch (error) {
      throw toEndpointSaveError(error, 'scenarios', persistedEndpointId, true);
    }

    try {
      const detail = await this.api.get<EndpointDto>(`/projects/${projectId}/endpoints/${endpoint.id}`);
      return mapEndpointSummaryFromApi(detail);
    } catch (error) {
      throw toEndpointSaveError(error, 'refresh', persistedEndpointId, true);
    }
  }

  async deleteEndpoint(projectId: string, endpointId: string): Promise<void> {
    await this.api.delete(`/projects/${projectId}/endpoints/${endpointId}`);
  }

  private async reconcileScenarios(endpointId: string, draft: EndpointDraft): Promise<void> {
    const existing = await this.api.get<ScenarioDto[]>(`/endpoints/${endpointId}/scenarios`);
    const existingById = new Map(existing.map((scenario) => [scenario.id, scenario]));
    const seen = new Set<string>();

    await Promise.all(
      draft.scenarios.map(async (scenario) => {
        const payload = buildScenarioPayload(scenario);

        if (existingById.has(scenario.id)) {
          seen.add(scenario.id);
          if (haveSameScenarioPayload(payload, buildScenarioPayload(existingById.get(scenario.id)!))) {
            return;
          }

          await this.api.patch(`/endpoints/${endpointId}/scenarios/${scenario.id}`, payload);
          return;
        }

        await this.api.post(`/endpoints/${endpointId}/scenarios`, payload);
      }),
    );

    await Promise.all(
      existing
        .filter(
          (scenario) =>
            !seen.has(scenario.id) && !draft.scenarios.some((draftScenario) => draftScenario.id === scenario.id),
        )
        .map((scenario) => this.api.delete(`/endpoints/${endpointId}/scenarios/${scenario.id}`)),
    );
  }
}
