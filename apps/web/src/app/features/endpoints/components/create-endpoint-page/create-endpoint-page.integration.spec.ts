import { Injector, runInInjectionContext } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideAngularReactiveSchedulers, setupAngularVitest } from '../../../../testing/angular-vitest';
import { ApiClient } from '../../../../shared/http/api-client';
import { ApiError } from '../../../../shared/http/api-error.mapper';
import type { EndpointPreview } from '../../../../shared/models/endpoint-preview.model';
import { EndpointsRepository } from '../../data-access/endpoints.repository';
import type { EndpointDraft } from '../../models/endpoint-draft.model';
import { EndpointAiGeneratorService } from '../../services/endpoint-ai-generator.service';
import { CreateEndpointPageComponent } from './create-endpoint-page.component';

setupAngularVitest();

type WritableSignalHarness<T> = {
  (): T;
  set(value: T): void;
};

type OutputHarness<T> = {
  emit(value: T): void;
};

type CreateEndpointPageHarness = {
  projectId: () => string | null;
  apiBaseUrl: () => string;
  initialEndpoint: () => EndpointPreview | null;
  isEditing: () => boolean;
  promptText: WritableSignalHarness<string>;
  generating: () => boolean;
  generationError: () => string | null;
  reviewMethod: () => string;
  reviewRoute: () => string;
  step: WritableSignalHarness<'prompt' | 'review' | 'editor'>;
  draft: WritableSignalHarness<EndpointDraft | null>;
  loadingError: () => string | null;
  saveError: () => string | null;
  saved: OutputHarness<EndpointPreview>;
  cancelled: OutputHarness<void>;
  canSave(): boolean;
  onGenerateRequested(): Promise<void>;
  continueFromReview(): void;
  cancel(): void;
  saveEndpoint(): Promise<void>;
  hydrateDraft(projectId: string, preview: EndpointPreview): Promise<void>;
};

type RenderSnapshot = {
  content: string;
  routeValue: string | null;
  statusValue: string | null;
  saveDisabled: boolean;
};

function renderSnapshot(component: CreateEndpointPageHarness): RenderSnapshot {
  const content: string[] = [component.isEditing() ? 'Edit endpoint' : 'Create endpoint'];
  const draft = component.draft();

  if (component.loadingError()) content.push(component.loadingError()!);
  if (component.saveError()) content.push(component.saveError()!);
  if (draft) {
    content.push(draft.description);
    content.push(`Scenarios ${draft.scenarios.length}`);
    for (const scenario of draft.scenarios) content.push(scenario.name);
  }

  if (component.step() === 'editor') content.push('Save endpoint');

  return {
    content: content.join(' | '),
    routeValue: draft?.route ?? null,
    statusValue: draft ? String(draft.statusCode) : null,
    saveDisabled: !component.canSave(),
  };
}

const previewFixture: EndpointPreview = {
  id: 'e1',
  method: 'PATCH',
  path: '/users/1',
  description: 'Update user',
  latencyMs: 150,
  statusCode: 200,
  responseBody: { ok: true },
  responseHeaders: { 'content-type': 'application/json' },
  config: {
    latencyMs: 150,
    errorRatePct: 0,
    scenarios: { success: true, empty: false, error: false, timeout: false },
  },
};

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

describe('CreateEndpointPageComponent integration', () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.patch.mockReset();
    api.delete.mockReset();
  });

  function createComponent() {
    const injector = Injector.create({
      providers: [
        ...provideAngularReactiveSchedulers(),
        EndpointsRepository,
        { provide: ApiClient, useValue: api },
        EndpointAiGeneratorService,
      ],
    });

    return runInInjectionContext(
      injector,
      () => new CreateEndpointPageComponent(),
    ) as unknown as CreateEndpointPageHarness;
  }

  it('emits a saved endpoint after a successful manual create flow', async () => {
    api.post.mockImplementation(async (path: string) => {
      if (path === '/projects/p1/endpoints') {
        return {
          id: 'e1',
          projectId: 'p1',
          method: 'POST',
          path: '/users',
          description: 'Create user',
          statusCode: 201,
          responseBody: { ok: true },
        };
      }

      if (path === '/endpoints/e1/scenarios') return { id: 's1' };
      throw new Error(`Unexpected POST ${path}`);
    });
    api.put.mockResolvedValue({});
    api.get.mockImplementation(async (path: string) => {
      if (path === '/endpoints/e1/scenarios') return [];
      if (path === '/projects/p1/endpoints/e1') {
        return {
          id: 'e1',
          projectId: 'p1',
          method: 'POST',
          path: '/users',
          description: 'Create user',
          statusCode: 201,
          responseBody: { ok: true },
          endpointConfig: {
            endpointId: 'e1',
            latencyMode: 'fixed',
            fixedDelayMs: 120,
            minDelayMs: 0,
            maxDelayMs: 500,
            errorRate: 0,
            useScenarioWeights: true,
          },
          scenarios: [
            {
              id: 's1',
              endpointId: 'e1',
              name: 'Success',
              type: 'success',
              statusCode: 201,
              body: { ok: true },
              delayMs: 120,
              weight: 100,
            },
          ],
        };
      }

      throw new Error(`Unexpected GET ${path}`);
    });

    const component = createComponent();
    component.projectId = () => 'p1';
    component.step.set('editor');
    component.draft.set(draftFixture);

    const savedEmit = vi.spyOn(component.saved, 'emit');
    const beforeSave = renderSnapshot(component);
    expect(beforeSave.saveDisabled).toBe(false);

    await component.saveEndpoint();

    expect(api.post).toHaveBeenCalledWith('/projects/p1/endpoints', expect.any(Object));
    expect(api.put).toHaveBeenCalledWith('/endpoints/e1/config', expect.any(Object));
    expect(savedEmit).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1', path: '/users' }));
    expect(renderSnapshot(component).content).not.toContain('Could not save endpoint.');
  });

  it('keeps the wizard open and shows a failure message after a partial save failure', async () => {
    api.post.mockResolvedValue({
      id: 'e1',
      projectId: 'p1',
      method: 'POST',
      path: '/users',
      description: 'Create user',
      statusCode: 201,
      responseBody: { ok: true },
    });
    api.put.mockRejectedValue(new Error('Config persistence failed'));
    api.get.mockImplementation(async (path: string) => {
      if (path === '/endpoints/e1/scenarios') return [];
      throw new Error(`Unexpected GET ${path}`);
    });

    const component = createComponent();
    component.projectId = () => 'p1';
    component.step.set('editor');
    component.draft.set(draftFixture);

    await component.saveEndpoint();

    const snapshot = renderSnapshot(component);
    expect(snapshot.content).toContain('Create endpoint');
    expect(snapshot.content).toContain('Config persistence failed');
    expect(snapshot.content).toContain('Save endpoint');
  });

  it('runs prompt -> preview -> review -> editor -> save using the backend preview contract', async () => {
    api.post.mockImplementation(async (path: string) => {
      if (path === '/projects/p1/endpoints/ai-preview') {
        return {
          method: 'POST',
          path: '/users',
          description: 'Create user',
          statusCode: 201,
          responseBody: { id: 'u1' },
          locks: { method: true, path: true },
          scenarios: [
            {
              name: 'Success',
              type: 'success',
              statusCode: 201,
              body: { id: 'u1' },
              delayMs: 120,
              weight: 100,
            },
          ],
        };
      }

      if (path === '/projects/p1/endpoints') {
        return {
          id: 'e1',
          projectId: 'p1',
          method: 'POST',
          path: '/users',
          description: 'Create user',
          statusCode: 201,
          responseBody: { id: 'u1' },
        };
      }

      if (path === '/endpoints/e1/scenarios') return { id: 's1' };
      throw new Error(`Unexpected POST ${path}`);
    });
    api.put.mockResolvedValue({});
    api.get.mockImplementation(async (path: string) => {
      if (path === '/endpoints/e1/scenarios') return [];
      if (path === '/projects/p1/endpoints/e1') {
        return {
          id: 'e1',
          projectId: 'p1',
          method: 'POST',
          path: '/users',
          description: 'Create user',
          statusCode: 201,
          responseBody: { id: 'u1' },
          endpointConfig: {
            endpointId: 'e1',
            latencyMode: 'fixed',
            fixedDelayMs: 150,
            minDelayMs: 0,
            maxDelayMs: 500,
            errorRate: 0,
            useScenarioWeights: true,
          },
          scenarios: [
            {
              id: 's1',
              endpointId: 'e1',
              name: 'Success',
              type: 'success',
              statusCode: 201,
              body: { id: 'u1' },
              delayMs: 120,
              weight: 100,
            },
          ],
        };
      }

      throw new Error(`Unexpected GET ${path}`);
    });

    const component = createComponent();
    component.projectId = () => 'p1';
    component.promptText.set('Create a user endpoint with success scenario');

    await component.onGenerateRequested();

    expect(api.post).toHaveBeenCalledWith('/projects/p1/endpoints/ai-preview', {
      prompt: 'Create a user endpoint with success scenario',
    });
    expect(component.step()).toBe('review');
    expect(component.reviewMethod()).toBe('POST');
    expect(component.reviewRoute()).toBe('/users');
    expect(component.draft()).toMatchObject({
      source: 'ai-preview',
      locks: { method: true, path: true, scenarioType: true },
    });

    component.continueFromReview();
    expect(component.step()).toBe('editor');

    const savedEmit = vi.spyOn(component.saved, 'emit');
    await component.saveEndpoint();

    expect(api.post).toHaveBeenCalledWith('/projects/p1/endpoints', expect.objectContaining({ path: '/users' }));
    expect(savedEmit).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1', path: '/users' }));
  });

  it('keeps the wizard on prompt, shows actionable error copy, and allows retry after preview failure', async () => {
    api.post
      .mockRejectedValueOnce(new ApiError(504, 'AI request timed out', undefined, 'AI_TIMEOUT', true))
      .mockResolvedValueOnce({
        method: 'GET',
        path: '/users',
        description: 'List users',
        statusCode: 200,
        responseBody: [{ id: 'u1' }],
        locks: { method: true, path: true },
        scenarios: [
          {
            name: 'Success',
            type: 'success',
            statusCode: 200,
            body: [{ id: 'u1' }],
            delayMs: 0,
            weight: 100,
          },
        ],
      });

    const component = createComponent();
    component.projectId = () => 'p1';
    component.promptText.set('List users with retry support');

    await component.onGenerateRequested();

    expect(component.step()).toBe('prompt');
    expect(component.generationError()).toContain('AI timed out');
    expect(component.generating()).toBe(false);

    await component.onGenerateRequested();

    expect(component.step()).toBe('review');
    expect(component.generationError()).toBeNull();
    expect(component.draft()?.route).toBe('/users');
  });

  it('shows unavailable-now fallback copy when backend reports missing OpenAI config', async () => {
    api.post.mockRejectedValueOnce(
      new ApiError(503, 'AI is unavailable right now', 'OPENAI_API_KEY is not configured', 'AI_UNAVAILABLE', false),
    );

    const component = createComponent();
    component.projectId = () => 'p1';
    component.promptText.set('List users while AI config is missing');

    await component.onGenerateRequested();

    expect(component.step()).toBe('prompt');
    expect(component.generationError()).toBe('AI is unavailable right now. Retry in a moment or continue manually.');
    expect(component.generating()).toBe(false);
  });

  it('cancels an in-flight preview so stale results do not reopen the wizard flow', async () => {
    let resolvePreview!: (value: unknown) => void;
    api.post.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePreview = resolve;
        }),
    );

    const component = createComponent();
    component.projectId = () => 'p1';
    component.promptText.set('Create a cancellable user endpoint');
    const cancelledEmit = vi.spyOn(component.cancelled, 'emit');

    const requestPromise = component.onGenerateRequested();
    expect(component.generating()).toBe(true);

    component.cancel();
    resolvePreview({
      method: 'POST',
      path: '/users',
      description: 'Create user',
      statusCode: 201,
      responseBody: { id: 'u1' },
      locks: { method: true, path: true },
      scenarios: [
        {
          name: 'Success',
          type: 'success',
          statusCode: 201,
          body: { id: 'u1' },
          delayMs: 0,
          weight: 100,
        },
      ],
    });
    await requestPromise;

    expect(cancelledEmit).toHaveBeenCalledTimes(1);
    expect(component.step()).toBe('prompt');
    expect(component.draft()).toBeNull();
    expect(component.generating()).toBe(false);
  });

  it('hydrates the edit wizard with backend detail data', async () => {
    api.get.mockResolvedValue({
      id: 'e1',
      projectId: 'p1',
      method: 'PATCH',
      path: '/users/1',
      description: 'Update user',
      statusCode: 200,
      responseBody: { ok: true },
      endpointConfig: {
        endpointId: 'e1',
        latencyMode: 'range',
        fixedDelayMs: 0,
        minDelayMs: 50,
        maxDelayMs: 250,
        errorRate: 0.15,
        useScenarioWeights: false,
      },
      scenarios: [
        {
          id: 's1',
          endpointId: 'e1',
          name: 'Success',
          type: 'success',
          statusCode: 200,
          body: { ok: true },
          delayMs: 50,
          weight: 70,
        },
        {
          id: 's2',
          endpointId: 'e1',
          name: 'Timeout',
          type: 'timeout',
          statusCode: 408,
          body: { error: 'timeout' },
          delayMs: 5000,
          weight: 30,
        },
      ],
    });

    const component = createComponent();
    component.isEditing = () => true;

    await component.hydrateDraft('p1', previewFixture);

    const snapshot = renderSnapshot(component);
    expect(api.get).toHaveBeenCalledWith('/projects/p1/endpoints/e1');
    expect(snapshot.content).toContain('Edit endpoint');
    expect(snapshot.routeValue).toBe('/users/1');
    expect(snapshot.statusValue).toBe('200');
    expect(snapshot.content).toContain('Update user');
  });

  it('keeps editing available with defaulted data when related backend resources are missing', async () => {
    api.get.mockResolvedValue({
      id: 'e1',
      projectId: 'p1',
      method: 'PUT',
      path: '/users/1',
      description: 'Replace user',
      statusCode: 200,
      responseBody: { ok: true },
      endpointConfig: null,
      scenarios: [],
    });

    const component = createComponent();
    component.isEditing = () => true;

    await component.hydrateDraft('p1', { ...previewFixture, method: 'PUT', description: 'Replace user' });

    const snapshot = renderSnapshot(component);
    expect(snapshot.routeValue).toBe('/users/1');
    expect(snapshot.content).toContain('Success');
    expect(snapshot.content).toContain('Scenarios 1');
    expect(snapshot.saveDisabled).toBe(false);
  });
});
