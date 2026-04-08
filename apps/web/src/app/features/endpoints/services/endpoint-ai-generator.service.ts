import { Injectable, inject } from '@angular/core';
import type { EndpointDraft } from '../models/endpoint-draft.model';
import { EndpointsRepository } from '../data-access/endpoints.repository';

@Injectable({ providedIn: 'root' })
export class EndpointAiGeneratorService {
  private readonly endpointsRepository = inject(EndpointsRepository);

  generateFromPrompt(projectId: string, prompt: string): Promise<EndpointDraft> {
    return this.endpointsRepository.previewAiDraft(projectId, prompt);
  }
}
