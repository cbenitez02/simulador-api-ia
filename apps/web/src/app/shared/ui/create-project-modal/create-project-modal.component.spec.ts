import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  provideAngularReactiveSchedulers,
  resolveAngularExternalResources,
  setupAngularVitest,
} from '../../../testing/angular-vitest';
import type {
  CreateProjectModalPayload,
  CreateProjectPartialSuccessState,
  EditProjectModalPayload,
  ProjectModalWorkspaceOption,
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
  availableWorkspaces: () => ProjectModalWorkspaceOption[];
  selectedWorkspaceId: WritableSignalLike<string>;
  projectName: WritableSignalLike<string>;
  description: WritableSignalLike<string>;
  slug: WritableSignalLike<string>;
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
  createProjectOnly: { emit(value: CreateProjectModalPayload): void };
  onContinueManuallyClick(): void;
  saveProject: { emit(value: EditProjectModalPayload): void };
  continueManually: { emit(value: string): void };
};

const workspaceOptions: ProjectModalWorkspaceOption[] = [
  {
    id: 'workspace-1',
    name: 'Personal workspace',
    kind: 'personal',
    role: 'owner',
    isPersonal: true,
    capabilities: { canEdit: true, canManageMembers: true },
  },
  {
    id: 'workspace-2',
    name: 'Equipo Plataforma',
    kind: 'team',
    role: 'editor',
    isPersonal: false,
    capabilities: { canEdit: true, canManageMembers: false },
  },
];

async function renderComponent(
  inputs?: Partial<{
    open: boolean;
    mode: ProjectModalMode;
    availableWorkspaces: ProjectModalWorkspaceOption[];
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
    availableWorkspaces: () => ProjectModalWorkspaceOption[];
  };
  component.open = () => inputs?.open ?? true;
  component.mode = () => inputs?.mode ?? 'edit';
  component.availableWorkspaces = () => inputs?.availableWorkspaces ?? [];
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

    const component = runInInjectionContext(
      injector,
      () => new CreateProjectModalComponent(),
    ) as unknown as CreateProjectModalHarness;
    component.availableWorkspaces = () => [];
    return component;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('switches to edit copy and save behavior without exposing AI-only requirements', () => {
    const component = createComponent();
    component.mode = () => 'edit';
    component.availableWorkspaces = () => workspaceOptions;
    component.selectedWorkspaceId.set('workspace-2');
    component.projectName.set('Workspace API');
    component.description.set('Updated description');
    component.slug.set('workspace-api');
    component.prompt.set('');

    const saveEmit = vi.spyOn(component.saveProject, 'emit');

    expect(component.isEditMode()).toBe(true);
    expect(component.modalTitle()).toBe('Edit project');
    expect(component.modalSubtitle()).toContain('base mock domain stays the same');
    expect(component.stableUrlMessage()).toContain('Previous URL stops working');
    expect(component.primaryLabel()).toBe('Save changes');
    expect(component.primaryDisabled()).toBe(false);

    component.onPrimaryClick();

    expect(saveEmit).toHaveBeenCalledWith({
      name: 'Workspace API',
      description: 'Updated description',
      slug: 'workspace-api',
      workspaceId: 'workspace-2',
    });
  });

  it('keeps edited values intact after a recoverable edit failure', () => {
    const component = createComponent();
    component.mode = () => 'edit';
    component.projectName.set('Initial');
    component.description.set('Before');
    component.slug.set('initial');

    component.projectName.set('Renamed project');
    component.description.set('After error');
    component.slug.set('renamed-project');

    expect(component.projectName()).toBe('Renamed project');
    expect(component.description()).toBe('After error');
    expect(component.slug()).toBe('renamed-project');
    expect(component.primaryDisabled()).toBe(false);
  });

  it('renders editable slug and workspace controls in edit mode', async () => {
    const element = await renderComponent({ open: true, mode: 'edit', availableWorkspaces: workspaceOptions });
    const editableFields = Array.from(element.querySelectorAll('input, textarea')).map((field) => ({
      id: field.getAttribute('id') ?? '',
      name: field.getAttribute('name') ?? '',
      placeholder: field.getAttribute('placeholder') ?? '',
    }));

    expect(element.textContent).toContain('Changing the slug updates the mock URL path immediately');
    expect(element.querySelector('input[placeholder="User service API"]')).not.toBeNull();
    expect(element.querySelector('input[placeholder="users-api"]')).not.toBeNull();
    expect(element.querySelector('select')).not.toBeNull();
    expect(
      editableFields.some((field) => /slug|mock\s*url|mockurl/i.test(`${field.id} ${field.name} ${field.placeholder}`)),
    ).toBe(true);
  });

  it('still requires an endpoint prompt in create mode when AI generation is enabled', () => {
    const component = createComponent();
    component.mode = () => 'create';
    component.availableWorkspaces = () => workspaceOptions;
    component.selectedWorkspaceId.set('workspace-1');
    component.projectName.set('Generated API');
    component.aiEnabled.set(true);
    component.prompt.set('');

    expect(component.primaryDisabled()).toBe(true);

    component.prompt.set('GET /users');

    expect(component.primaryDisabled()).toBe(false);
  });

  it('requires a non-empty slug in edit mode before saving', () => {
    const component = createComponent();
    component.mode = () => 'edit';
    component.projectName.set('Workspace API');
    component.description.set('Updated');
    component.slug.set('   ');

    expect(component.primaryDisabled()).toBe(true);
  });

  it('requires a workspace selection in edit mode when workspace options are available', () => {
    const component = createComponent();
    component.mode = () => 'edit';
    component.availableWorkspaces = () => workspaceOptions;
    component.projectName.set('Workspace API');
    component.description.set('Updated');
    component.slug.set('workspace-api');
    component.selectedWorkspaceId.set('');

    expect(component.primaryDisabled()).toBe(true);
  });

  it('switches to partial-success copy that confirms project creation and routes into manual setup', () => {
    const component = createComponent();
    component.mode = () => 'create';
    component.partialSuccessState = () => ({
      createdProjectId: 'p1',
      projectName: 'Generated API',
      endpointPrompt: 'Create a users endpoint',
      message: 'Your project is ready, but the first endpoint was not created.',
      retryable: true,
    });

    const continueEmit = vi.spyOn(component.continueManually, 'emit');

    expect(component.isPartialSuccess()).toBe(true);
    expect(component.modalTitle()).toContain('Project created');
    expect(component.modalSubtitle()).toContain('Continue with manual endpoint setup');
    expect(component.primaryLabel()).toBe('Continue manually');
    expect(component.primaryDisabled()).toBe(false);

    component.onPrimaryClick();
    component.onContinueManuallyClick();

    expect(continueEmit).toHaveBeenCalledTimes(2);
    expect(continueEmit).toHaveBeenNthCalledWith(1, 'p1');
    expect(continueEmit).toHaveBeenNthCalledWith(2, 'p1');
  });

  it('keeps submit actions blocked while create-project plus endpoint generation is still running', () => {
    const component = createComponent();
    component.mode = () => 'create';
    component.availableWorkspaces = () => workspaceOptions;
    component.selectedWorkspaceId.set('workspace-1');
    component.loading = () => true;
    component.projectName.set('Generated API');
    component.aiEnabled.set(true);
    component.prompt.set('Create a users endpoint');

    expect(component.primaryLabel()).toBe('Generating...');
    expect(component.primaryDisabled()).toBe(true);
  });

  it('requires a workspace selection before creating a project', () => {
    const component = createComponent();
    component.mode = () => 'create';
    component.availableWorkspaces = () => workspaceOptions;
    component.projectName.set('Generated API');
    component.aiEnabled.set(false);
    component.selectedWorkspaceId.set('');

    expect(component.primaryDisabled()).toBe(true);
  });

  it('emits the selected workspaceId when creating a project without AI', () => {
    const component = createComponent();
    component.mode = () => 'create';
    component.availableWorkspaces = () => workspaceOptions;
    component.projectName.set('Generated API');
    component.description.set('Workspace scoped');
    component.aiEnabled.set(false);
    component.selectedWorkspaceId.set('workspace-2');

    const emitSpy = vi.spyOn(component.createProjectOnly, 'emit');

    component.onPrimaryClick();

    expect(emitSpy).toHaveBeenCalledWith({
      name: 'Generated API',
      description: 'Workspace scoped',
      workspaceId: 'workspace-2',
    });
  });
});
