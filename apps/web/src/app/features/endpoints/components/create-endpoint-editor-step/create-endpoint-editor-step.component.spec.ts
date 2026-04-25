import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { provideAngularReactiveSchedulers, setupAngularVitest } from '../../../../testing/angular-vitest';
import type { EndpointDraft } from '../../models/endpoint-draft.model';
import { CreateEndpointEditorStepComponent } from './create-endpoint-editor-step.component';

setupAngularVitest();

type EditorHarness = CreateEndpointEditorStepComponent & {
  draft: () => EndpointDraft;
  draftChange: { emit(value: EndpointDraft): void };
  onMethodChange(value: string): void;
  addPreset(kind: 'empty' | 'error' | 'timeout' | 'unauthorized'): void;
};

const draftFixture: EndpointDraft = {
  method: 'GET',
  route: '/users',
  description: 'List users',
  statusCode: 200,
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
      id: 'success-1',
      name: 'Success',
      type: 'success',
      statusCode: 200,
      body: { ok: true },
      delayMs: 120,
      weight: 100,
    },
  ],
  locks: { method: false, path: false, scenarioType: false },
  source: 'manual',
};

function createComponent(draft: EndpointDraft = draftFixture): EditorHarness {
  const injector = Injector.create({
    providers: [...provideAngularReactiveSchedulers()],
  });
  const component = runInInjectionContext(injector, () => new CreateEndpointEditorStepComponent()) as EditorHarness;
  Object.defineProperty(component, 'draft', {
    value: (() => draft) as unknown as EditorHarness['draft'],
  });
  Object.defineProperty(component, 'draftChange', {
    value: { emit: vi.fn() } as unknown as EditorHarness['draftChange'],
  });
  return component;
}

describe('CreateEndpointEditorStepComponent', () => {
  it('updates the draft status and success scenario statuses when the method changes', () => {
    const component = createComponent();

    component.onMethodChange('POST');

    expect(component.draftChange.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        statusCode: 201,
        scenarios: [
          expect.objectContaining({
            id: 'success-1',
            statusCode: 201,
          }),
        ],
      }),
    );
  });

  it('keeps edit-mode method changes read-only when the draft is locked', () => {
    const component = createComponent({
      ...draftFixture,
      locks: { method: true, path: true, scenarioType: false },
      source: 'existing',
    });

    component.onMethodChange('DELETE');

    expect(component.draftChange.emit).not.toHaveBeenCalled();
  });

  it('adds an empty preset with delete-specific defaults', () => {
    const component = createComponent({
      ...draftFixture,
      method: 'DELETE',
      statusCode: 204,
      scenarios: [...draftFixture.scenarios],
    });

    component.addPreset('empty');

    expect(component.draftChange.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarios: expect.arrayContaining([
          expect.objectContaining({
            name: 'Empty',
            type: 'empty',
            statusCode: 204,
            body: null,
          }),
        ]),
      }),
    );
  });
});
