import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  provideAngularReactiveSchedulers,
  resolveAngularExternalResources,
  setupAngularVitest,
} from '../../../testing/angular-vitest';
import type {
  CreateProjectPartialSuccessState,
  EditProjectModalPayload,
  ProjectModalMode,
} from './create-project-modal.model';
import { CreateProjectModalComponent } from './create-project-modal.component';

setupAngularVitest();

type WritableSignalLike<T> = {
  (): T;
  set(value: T): void;
};

type CreateProjectModalHarness = {
  mode: () => ProjectModalMode;
  loading: () => boolean;
  partialSuccessState: () => CreateProjectPartialSuccessState | null;
  projectName: WritableSignalLike<string>;
  description: WritableSignalLike<string>;
  prompt: WritableSignalLike<string>;
  aiEnabled: WritableSignalLike<boolean>;
  isEditMode: () => boolean;
  isPartialSuccess: () => boolean;
  modalTitle: () => string;
  modalSubtitle: () => string;
  stableUrlMessage: () => string;
  primaryLabel: () => string;
  primaryDisabled: () => boolean;
  onPrimaryClick(): void;
  onContinueManuallyClick(): void;
  saveProject: { emit(value: EditProjectModalPayload): void };
  retryEndpointGeneration: { emit(value: CreateProjectPartialSuccessState): void };
  continueManually: { emit(value: string): void };
};

async function renderComponent(
  inputs?: Partial<{
    open: boolean;
    mode: ProjectModalMode;
  }>,
): Promise<HTMLElement> {
  await resolveAngularExternalResources();
  await TestBed.configureTestingModule({
    imports: [CreateProjectModalComponent],
  }).compileComponents();

  const fixture = TestBed.createComponent(CreateProjectModalComponent);
  const component = fixture.componentInstance as unknown as {
    open: () => boolean;
    mode: () => ProjectModalMode;
  };
  component.open = () => inputs?.open ?? true;
  component.mode = () => inputs?.mode ?? 'edit';
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture.nativeElement as HTMLElement;
}

describe('CreateProjectModalComponent', () => {
  function createComponent() {
    const injector = Injector.create({
      providers: [...provideAngularReactiveSchedulers()],
    });

    return runInInjectionContext(
      injector,
      () => new CreateProjectModalComponent(),
    ) as unknown as CreateProjectModalHarness;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('switches to edit copy and save behavior without exposing AI-only requirements', () => {
    const component = createComponent();
    component.mode = () => 'edit';
    component.projectName.set('Workspace API');
    component.description.set('Updated description');
    component.prompt.set('');

    const saveEmit = vi.spyOn(component.saveProject, 'emit');

    expect(component.isEditMode()).toBe(true);
    expect(component.modalTitle()).toBe('Edit project');
    expect(component.modalSubtitle()).toContain('stable mock URL stays exactly the same');
    expect(component.stableUrlMessage()).toContain('does not change its slug or mock URL');
    expect(component.primaryLabel()).toBe('Save changes');
    expect(component.primaryDisabled()).toBe(false);

    component.onPrimaryClick();

    expect(saveEmit).toHaveBeenCalledWith({
      name: 'Workspace API',
      description: 'Updated description',
    });
  });

  it('keeps edited values intact after a recoverable edit failure', () => {
    const component = createComponent();
    component.mode = () => 'edit';
    component.projectName.set('Initial');
    component.description.set('Before');

    component.projectName.set('Renamed project');
    component.description.set('After error');

    expect(component.projectName()).toBe('Renamed project');
    expect(component.description()).toBe('After error');
    expect(component.primaryDisabled()).toBe(false);
  });

  it('does not render editable slug or mock URL controls in edit mode', async () => {
    const element = await renderComponent({ open: true, mode: 'edit' });
    const editableFields = Array.from(element.querySelectorAll('input, textarea')).map((field) => ({
      id: field.getAttribute('id') ?? '',
      name: field.getAttribute('name') ?? '',
      placeholder: field.getAttribute('placeholder') ?? '',
    }));

    expect(element.textContent).toContain('does not change its slug or mock URL');
    expect(element.querySelector('input[placeholder="User service API"]')).not.toBeNull();
    expect(
      editableFields.some((field) => /slug|mock\s*url|mockurl/i.test(`${field.id} ${field.name} ${field.placeholder}`)),
    ).toBe(false);
  });

  it('still requires an endpoint prompt in create mode when AI generation is enabled', () => {
    const component = createComponent();
    component.mode = () => 'create';
    component.projectName.set('Generated API');
    component.aiEnabled.set(true);
    component.prompt.set('');

    expect(component.primaryDisabled()).toBe(true);

    component.prompt.set('GET /users');

    expect(component.primaryDisabled()).toBe(false);
  });

  it('switches to partial-success copy and retry/continue actions after project creation succeeds but endpoint generation fails', () => {
    const component = createComponent();
    component.mode = () => 'create';
    component.partialSuccessState = () => ({
      createdProjectId: 'p1',
      projectName: 'Generated API',
      endpointPrompt: 'Create a users endpoint',
      message: 'Your project is ready, but the first endpoint was not created.',
      retryable: true,
    });

    const retryEmit = vi.spyOn(component.retryEndpointGeneration, 'emit');
    const continueEmit = vi.spyOn(component.continueManually, 'emit');

    expect(component.isPartialSuccess()).toBe(true);
    expect(component.modalTitle()).toContain('Project created');
    expect(component.modalSubtitle()).toContain('Retry generation or continue manually');
    expect(component.primaryLabel()).toBe('Retry generation');
    expect(component.primaryDisabled()).toBe(false);

    component.onPrimaryClick();
    component.onContinueManuallyClick();

    expect(retryEmit).toHaveBeenCalledWith(expect.objectContaining({ createdProjectId: 'p1' }));
    expect(continueEmit).toHaveBeenCalledWith('p1');
  });

  it('keeps submit actions blocked while create-project plus endpoint generation is still running', () => {
    const component = createComponent();
    component.mode = () => 'create';
    component.loading = () => true;
    component.projectName.set('Generated API');
    component.aiEnabled.set(true);
    component.prompt.set('Create a users endpoint');

    expect(component.primaryLabel()).toBe('Generating...');
    expect(component.primaryDisabled()).toBe(true);
  });
});
