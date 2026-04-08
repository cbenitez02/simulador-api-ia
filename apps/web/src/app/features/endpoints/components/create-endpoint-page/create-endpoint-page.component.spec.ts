import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideAngularReactiveSchedulers, setupAngularVitest } from '../../../../testing/angular-vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import type { EndpointPreview } from '../../../../shared/models/endpoint-preview.model';
import type { EndpointDraft } from '../../models/endpoint-draft.model';
import { EndpointsRepository } from '../../data-access/endpoints.repository';
import { EndpointAiGeneratorService } from '../../services/endpoint-ai-generator.service';
import { CreateEndpointPageComponent } from './create-endpoint-page.component';

setupAngularVitest();

type WritableSignalLike<T> = {
  (): T;
  set(value: T): void;
};

type CreateEndpointPageTestApi = {
  saved: { emit(value: EndpointPreview): void };
  projectId: () => string | null;
  promptText: WritableSignalLike<string>;
  reviewMethod: WritableSignalLike<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>;
  reviewRoute: WritableSignalLike<string>;
  step: WritableSignalLike<'prompt' | 'review' | 'editor'>;
  draft: WritableSignalLike<EndpointDraft | null>;
  loadingError: () => string | null;
  loadingDraft: () => boolean;
  generating: () => boolean;
  saving: () => boolean;
  sourcePrompt: () => string;
  canSave(): boolean;
  onGenerateRequested(): Promise<void>;
  continueFromReview(): void;
  saveEndpoint(): Promise<void>;
  hydrateDraft(projectId: string, preview: EndpointPreview): Promise<void>;
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const draftFixture: EndpointDraft = {
  method: 'POST',
  route: '/users',
  description: 'Create user',
  statusCode: 201,
  responseBody: { ok: true },
  behavior: {
    latencyMode: 'fixed',
    fixedDelayMs: 120,
    minDelayMs: 0,
    maxDelayMs: 500,
    errorRate: 0,
    useScenarioWeights: true,
  },
  scenarios: [
    {
      id: 'draft-success',
      name: 'Success',
      type: 'success',
      statusCode: 201,
      body: { ok: true },
      delayMs: 120,
      weight: 100,
    },
  ],
  locks: { method: false, path: false, scenarioType: false },
  source: 'manual',
};

const previewFixture: EndpointPreview = {
  id: 'e1',
  method: 'PATCH',
  path: '/users/1',
  description: 'Update user',
  latencyMs: 150,
  statusCode: 200,
  responseBody: { ok: true },
  config: {
    latencyMs: 150,
    errorRatePct: 0,
    scenarios: {
      success: true,
      empty: false,
      error: false,
      timeout: false,
    },
  },
};

describe('CreateEndpointPageComponent', () => {
  const repository = {
    saveEndpoint: vi.fn(),
    loadDraft: vi.fn(),
  };
  const aiService = {
    generateFromPrompt: vi.fn(),
  };

  function createComponent() {
    const injector = Injector.create({
      providers: [
        ...provideAngularReactiveSchedulers(),
        { provide: EndpointsRepository, useValue: repository },
        { provide: EndpointAiGeneratorService, useValue: aiService },
      ],
    });

    return runInInjectionContext(
      injector,
      () => new CreateEndpointPageComponent(),
    ) as unknown as CreateEndpointPageTestApi;
  }

  beforeEach(() => {
    repository.saveEndpoint.mockReset();
    repository.loadDraft.mockReset();
    aiService.generateFromPrompt.mockReset();
  });

  it('prevents duplicate manual saves while the repository request is still pending', async () => {
    const saveRequest = deferred<EndpointPreview>();
    repository.saveEndpoint.mockReturnValue(saveRequest.promise);

    const component = createComponent();
    component.projectId = () => 'p1';
    component.step.set('editor');
    component.draft.set(draftFixture);

    const savedEmit = vi.spyOn(component.saved, 'emit');
    const firstSave = component.saveEndpoint();
    const secondSave = component.saveEndpoint();

    expect(repository.saveEndpoint).toHaveBeenCalledTimes(1);
    expect(repository.saveEndpoint).toHaveBeenCalledWith('p1', draftFixture, null);
    expect(component.saving()).toBe(true);
    expect(component.canSave()).toBe(false);

    saveRequest.resolve({
      id: 'e1',
      method: 'POST',
      path: '/users',
      description: 'Create user',
      latencyMs: 120,
      statusCode: 201,
      responseBody: { ok: true },
    });

    await firstSave;
    await secondSave;

    expect(savedEmit).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1', path: '/users' }));
    expect(component.saving()).toBe(false);
  });

  it('keeps editing available with fallback draft data when backend hydration fails', async () => {
    repository.loadDraft.mockRejectedValue(new Error('missing related resources'));

    const component = createComponent();

    await component.hydrateDraft('p1', previewFixture);

    expect(repository.loadDraft).toHaveBeenCalledWith('p1', 'e1');
    expect(component.step()).toBe('editor');
    expect(component.draft()).toMatchObject({
      method: 'PATCH',
      route: '/users/1',
      description: 'Update user',
      statusCode: 200,
    });
    expect(component.loadingError()).toBe(
      'We could not load the full backend draft. You can still edit the fallback data.',
    );
    expect(component.loadingDraft()).toBe(false);
    expect(component.sourcePrompt()).toBe('Update user');
    expect(component.canSave()).toBe(true);
  });

  it('prevents duplicate preview requests while AI generation is still pending', async () => {
    const previewRequest = deferred<EndpointDraft>();
    aiService.generateFromPrompt.mockReturnValue(previewRequest.promise);

    const component = createComponent();
    component.projectId = () => 'p1';
    component.promptText.set('Create users endpoint');

    const firstRequest = component.onGenerateRequested();
    const secondRequest = component.onGenerateRequested();

    expect(aiService.generateFromPrompt).toHaveBeenCalledTimes(1);
    expect(aiService.generateFromPrompt).toHaveBeenCalledWith('p1', 'Create users endpoint');
    expect(component.generating()).toBe(true);

    previewRequest.resolve({
      ...draftFixture,
      route: '/users',
      source: 'ai-preview',
      locks: { method: true, path: true, scenarioType: true },
    });

    await firstRequest;
    await secondRequest;

    expect(component.generating()).toBe(false);
    expect(component.step()).toBe('review');
  });

  it('keeps locked method and route from the AI draft when continuing from review', () => {
    const component = createComponent();
    component.step.set('review');
    component.draft.set({
      ...draftFixture,
      method: 'POST',
      route: '/users',
      statusCode: 201,
      source: 'ai-preview',
      locks: { method: true, path: true, scenarioType: true },
    });
    component.reviewMethod.set('DELETE');
    component.reviewRoute.set('/orders');

    component.continueFromReview();

    expect(component.step()).toBe('editor');
    expect(component.draft()).toMatchObject({
      method: 'POST',
      route: '/users',
      statusCode: 201,
      locks: { method: true, path: true, scenarioType: true },
    });
  });
});
