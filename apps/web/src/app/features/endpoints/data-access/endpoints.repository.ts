import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type { AiEndpointPreviewDto, CreateScenarioDto, EndpointDto, ScenarioDto } from '../../../shared/http/api.types';
import type { EndpointPreview } from '../../../shared/models/endpoint-preview.model';
import type { EndpointDraft } from '../models/endpoint-draft.model';
import {
  mapAiDraftFromApi,
  mapEndpointConfigRequestFromDraft,
  mapEndpointCreateRequestFromDraft,
  mapEndpointDraftFromApi,
  mapEndpointRequestFromDraft,
  mapEndpointSummaryFromApi,
} from '../adapters/endpoint-api.mapper';

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

  async saveEndpoint(projectId: string, draft: EndpointDraft, endpointId?: string | null): Promise<EndpointPreview> {
    const endpoint = endpointId
      ? await this.api.patch<EndpointDto, ReturnType<typeof mapEndpointRequestFromDraft>>(
          `/projects/${projectId}/endpoints/${endpointId}`,
          mapEndpointRequestFromDraft(draft),
        )
      : await this.api.post<EndpointDto, ReturnType<typeof mapEndpointCreateRequestFromDraft>>(
          `/projects/${projectId}/endpoints`,
          mapEndpointCreateRequestFromDraft(draft),
        );

    await this.api.put(`/endpoints/${endpoint.id}/config`, mapEndpointConfigRequestFromDraft(endpoint.id, draft));
    await this.reconcileScenarios(endpoint.id, draft);

    const detail = await this.api.get<EndpointDto>(`/projects/${projectId}/endpoints/${endpoint.id}`);
    return mapEndpointSummaryFromApi(detail);
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
        const payload: CreateScenarioDto = {
          name: scenario.name.trim() || 'Scenario',
          type: scenario.type === 'custom' ? 'success' : scenario.type,
          statusCode: scenario.statusCode,
          body: scenario.body,
          delayMs: scenario.delayMs,
          weight: Math.max(1, scenario.weight),
        };

        if (existingById.has(scenario.id)) {
          seen.add(scenario.id);
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
