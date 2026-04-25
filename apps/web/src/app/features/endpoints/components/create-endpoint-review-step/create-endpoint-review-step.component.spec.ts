import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { HTTP_METHOD_SELECT_OPTIONS } from '../../../../shared/constants/http-method-select-options';
import type { HttpMethod } from '../../../../shared/models/endpoint-preview.model';
import { CreateEndpointReviewStepComponent } from './create-endpoint-review-step.component';

type ReviewHarness = CreateEndpointReviewStepComponent & {
  methodLocked: () => boolean;
  routeLocked: () => boolean;
  methodChange: { emit(value: HttpMethod): void };
  routeChange: { emit(value: string): void };
  onMethodChange(value: string): void;
  onRouteInput(event: Event): void;
};

function createComponent(): ReviewHarness {
  const injector = Injector.create({ providers: [] });
  const component = runInInjectionContext(injector, () => new CreateEndpointReviewStepComponent()) as ReviewHarness;
  Object.defineProperty(component, 'methodChange', {
    value: { emit: vi.fn() } as unknown as ReviewHarness['methodChange'],
  });
  Object.defineProperty(component, 'routeChange', {
    value: { emit: vi.fn() } as unknown as ReviewHarness['routeChange'],
  });
  return component;
}

describe('CreateEndpointReviewStepComponent', () => {
  it('keeps backend-aligned manual method choices available', () => {
    expect(HTTP_METHOD_SELECT_OPTIONS.map((option) => option.value)).toEqual([
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'HEAD',
      'OPTIONS',
    ]);
  });

  it('emits manual method and route changes when the basics step is editable', () => {
    const component = createComponent();
    Object.defineProperty(component, 'methodLocked', {
      value: (() => false) as unknown as ReviewHarness['methodLocked'],
    });
    Object.defineProperty(component, 'routeLocked', {
      value: (() => false) as unknown as ReviewHarness['routeLocked'],
    });

    component.onMethodChange('HEAD');
    component.onRouteInput({ target: { value: '/health' } } as unknown as Event);

    expect(component.methodChange.emit).toHaveBeenCalledWith('HEAD');
    expect(component.routeChange.emit).toHaveBeenCalledWith('/health');
  });

  it('keeps ai-locked basics read-only when the review step is locked', () => {
    const component = createComponent();
    Object.defineProperty(component, 'methodLocked', {
      value: (() => true) as unknown as ReviewHarness['methodLocked'],
    });
    Object.defineProperty(component, 'routeLocked', {
      value: (() => true) as unknown as ReviewHarness['routeLocked'],
    });

    component.onMethodChange('DELETE');
    component.onRouteInput({ target: { value: '/orders' } } as unknown as Event);

    expect(component.methodChange.emit).not.toHaveBeenCalled();
    expect(component.routeChange.emit).not.toHaveBeenCalled();
  });
});
