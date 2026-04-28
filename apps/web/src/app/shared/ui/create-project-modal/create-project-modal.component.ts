import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideAlertTriangle, LucideLoader2, LucideSparkles } from '@lucide/angular';

import { projectRecoverySubtitle } from '../../utils/endpoint-flow-ui';
import { InlineAlertComponent } from '../inline-alert/inline-alert.component';
import { ToggleSwitchComponent } from '../toggle-switch/toggle-switch.component';
import type {
  CreateProjectModalPayload,
  CreateProjectPartialSuccessState,
  CreateProjectWithEndpointPayload,
  EditProjectModalPayload,
  ProjectModalInitialValues,
  ProjectModalMode,
  ProjectModalWorkspaceOption,
} from './create-project-modal.model';

let createProjectModalUid = 0;

@Component({
  selector: 'app-create-project-modal',
  standalone: true,
  imports: [InlineAlertComponent, LucideAlertTriangle, LucideLoader2, LucideSparkles, ToggleSwitchComponent],
  templateUrl: './create-project-modal.component.html',
  styleUrls: ['./create-project-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateProjectModalComponent {
  readonly open = input(false);
  readonly mode = input<ProjectModalMode>('create');
  readonly initialValues = input<ProjectModalInitialValues | null>(null);
  /** When true, primary action shows “Generating…” and all controls are disabled. */
  readonly loading = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly partialSuccessState = input<CreateProjectPartialSuccessState | null>(null);
  readonly availableWorkspaces = input<ProjectModalWorkspaceOption[]>([]);

  readonly cancelled = output<void>();
  readonly createProjectOnly = output<CreateProjectModalPayload>();
  readonly createProjectAndEndpoint = output<CreateProjectWithEndpointPayload>();
  readonly saveProject = output<EditProjectModalPayload>();
  readonly retryEndpointGeneration = output<CreateProjectPartialSuccessState>();
  readonly continueManually = output<string>();

  private readonly instanceId = ++createProjectModalUid;
  protected readonly titleDomId = `cnp-modal-title-${this.instanceId}`;
  protected readonly aiToggleId = `cnp-ai-toggle-${this.instanceId}`;
  protected readonly projectNameInputId = `cnp-project-name-${this.instanceId}`;
  protected readonly descriptionInputId = `cnp-description-${this.instanceId}`;
  protected readonly slugInputId = `cnp-slug-${this.instanceId}`;
  protected readonly promptInputId = `cnp-prompt-${this.instanceId}`;
  protected readonly workspaceSelectId = `cnp-workspace-${this.instanceId}`;

  protected readonly projectName = signal('');
  protected readonly description = signal('');
  protected readonly slug = signal('');
  protected readonly aiEnabled = signal(true);
  protected readonly prompt = signal('');
  protected readonly selectedWorkspaceId = signal('');

  protected readonly isEditMode = computed(() => this.mode() === 'edit');
  protected readonly isPartialSuccess = computed(() => this.partialSuccessState() !== null);

  protected readonly actionsDisabled = computed(() => this.loading() || this.isPartialSuccess());

  protected readonly primaryDisabled = computed(() => {
    if (this.loading()) return true;
    if (this.isPartialSuccess()) return !(this.partialSuccessState()?.retryable ?? false);
    const name = this.projectName().trim();
    if (!name) return true;
    if (this.isEditMode() && !this.slug().trim()) return true;
    if (this.availableWorkspaces().length > 0 && !this.selectedWorkspaceId().trim()) return true;
    if (!this.isEditMode() && this.aiEnabled() && !this.prompt().trim()) return true;
    return false;
  });

  protected readonly createOnlyDisabled = computed(
    () => this.loading() || this.isEditMode() || this.isPartialSuccess() || !this.projectName().trim(),
  );

  protected readonly modalTitle = computed(() => {
    if (this.isPartialSuccess()) return 'Project created — finish first endpoint';
    return this.isEditMode() ? 'Edit project' : 'Create new project';
  });

  protected readonly modalSubtitle = computed(() =>
    this.isPartialSuccess()
      ? projectRecoverySubtitle()
      : this.isEditMode()
        ? 'Update name, description and slug. The base mock domain stays the same.'
        : 'Name your project and optionally generate your first mock endpoint with AI.',
  );

  protected readonly stableUrlMessage = computed(
    () => 'Changing the slug updates the mock URL path immediately. Previous URL stops working.',
  );

  protected readonly primaryLabel = computed(() => {
    if (this.loading())
      return this.isEditMode() ? 'Saving changes...' : this.aiEnabled() ? 'Generating...' : 'Creating project...';
    if (this.isPartialSuccess()) return 'Continue manually';
    if (this.isEditMode()) return 'Save changes';
    return this.aiEnabled() ? 'Create project & endpoint' : 'Create project';
  });

  constructor() {
    let prevOpen = false;
    let prevInitialKey = '';

    effect(() => {
      const isOpen = this.open();
      const isEditMode = this.isEditMode();
      const initialValues = this.initialValues();
      const initialKey = `${this.mode()}::${initialValues?.name ?? ''}::${initialValues?.description ?? ''}::${initialValues?.slug ?? ''}`;

      if (isOpen && (!prevOpen || initialKey !== prevInitialKey)) {
        this.projectName.set(initialValues?.name ?? '');
        this.description.set(initialValues?.description ?? '');
        this.slug.set(initialValues?.slug ?? '');
        this.aiEnabled.set(isEditMode ? false : true);
        this.prompt.set('');
        this.selectedWorkspaceId.set(initialValues?.workspaceId ?? this.availableWorkspaces()[0]?.id ?? '');
      }

      prevOpen = isOpen;
      prevInitialKey = initialKey;
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open() || this.loading() || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.cancelled.emit();
  }

  protected onProjectNameInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.projectName.set(v);
  }

  protected onDescriptionInput(event: Event): void {
    this.description.set((event.target as HTMLTextAreaElement).value);
  }

  protected onPromptInput(event: Event): void {
    this.prompt.set((event.target as HTMLTextAreaElement).value);
  }

  protected onSlugInput(event: Event): void {
    this.slug.set((event.target as HTMLInputElement).value);
  }

  protected onAiToggle(checked: boolean): void {
    if (this.loading()) return;
    this.aiEnabled.set(checked);
  }

  protected onWorkspaceChange(event: Event): void {
    this.selectedWorkspaceId.set((event.target as HTMLSelectElement).value);
  }

  protected onCreateProjectOnlyClick(): void {
    if (this.createOnlyDisabled()) return;
    this.createProjectOnly.emit({
      name: this.projectName().trim(),
      description: this.description().trim(),
      workspaceId: this.selectedWorkspaceId().trim() || undefined,
    });
  }

  protected onPrimaryClick(): void {
    if (this.primaryDisabled()) return;
    if (this.isPartialSuccess()) {
      this.continueManually.emit(this.partialSuccessState()!.createdProjectId);
      return;
    }
    const name = this.projectName().trim();
    const description = this.description().trim();
    if (this.isEditMode()) {
      this.saveProject.emit({
        name,
        description,
        slug: this.slug().trim(),
        workspaceId: this.selectedWorkspaceId().trim() || undefined,
      });
      return;
    }

    if (this.aiEnabled()) {
      this.createProjectAndEndpoint.emit({
        name,
        description,
        workspaceId: this.selectedWorkspaceId().trim() || undefined,
        endpointPrompt: this.prompt().trim(),
      });
    } else {
      this.createProjectOnly.emit({ name, description, workspaceId: this.selectedWorkspaceId().trim() || undefined });
    }
  }

  protected onContinueManuallyClick(): void {
    const state = this.partialSuccessState();
    if (!state || this.loading()) return;
    this.continueManually.emit(state.createdProjectId);
  }
}
