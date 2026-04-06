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
import { LucideLoader2, LucideSparkles } from '@lucide/angular';

import { InlineAlertComponent } from '../inline-alert/inline-alert.component';
import { ToggleSwitchComponent } from '../toggle-switch/toggle-switch.component';
import type {
  CreateProjectModalPayload,
  CreateProjectWithEndpointPayload,
  EditProjectModalPayload,
  ProjectModalInitialValues,
  ProjectModalMode,
} from './create-project-modal.model';

let createProjectModalUid = 0;

@Component({
  selector: 'app-create-project-modal',
  standalone: true,
  imports: [InlineAlertComponent, LucideLoader2, LucideSparkles, ToggleSwitchComponent],
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

  readonly cancelled = output<void>();
  readonly createProjectOnly = output<CreateProjectModalPayload>();
  readonly createProjectAndEndpoint = output<CreateProjectWithEndpointPayload>();
  readonly saveProject = output<EditProjectModalPayload>();

  private readonly instanceId = ++createProjectModalUid;
  protected readonly titleDomId = `cnp-modal-title-${this.instanceId}`;
  protected readonly aiToggleId = `cnp-ai-toggle-${this.instanceId}`;
  protected readonly projectNameInputId = `cnp-project-name-${this.instanceId}`;
  protected readonly descriptionInputId = `cnp-description-${this.instanceId}`;
  protected readonly promptInputId = `cnp-prompt-${this.instanceId}`;

  protected readonly projectName = signal('');
  protected readonly description = signal('');
  protected readonly aiEnabled = signal(true);
  protected readonly prompt = signal('');

  protected readonly isEditMode = computed(() => this.mode() === 'edit');

  protected readonly actionsDisabled = computed(() => this.loading());

  protected readonly primaryDisabled = computed(() => {
    if (this.loading()) return true;
    const name = this.projectName().trim();
    if (!name) return true;
    if (!this.isEditMode() && this.aiEnabled() && !this.prompt().trim()) return true;
    return false;
  });

  protected readonly createOnlyDisabled = computed(
    () => this.loading() || this.isEditMode() || !this.projectName().trim(),
  );

  protected readonly modalTitle = computed(() => (this.isEditMode() ? 'Edit project' : 'Create new project'));

  protected readonly modalSubtitle = computed(() =>
    this.isEditMode()
      ? 'Update the project name and description. The stable mock URL stays exactly the same.'
      : 'Name your project and optionally generate your first mock endpoint with AI.',
  );

  protected readonly stableUrlMessage = computed(() => 'Renaming this project does not change its slug or mock URL.');

  protected readonly primaryLabel = computed(() => {
    if (this.loading())
      return this.isEditMode() ? 'Saving changes...' : this.aiEnabled() ? 'Generating...' : 'Creating project...';
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
      const initialKey = `${this.mode()}::${initialValues?.name ?? ''}::${initialValues?.description ?? ''}`;

      if (isOpen && (!prevOpen || initialKey !== prevInitialKey)) {
        this.projectName.set(initialValues?.name ?? '');
        this.description.set(initialValues?.description ?? '');
        this.aiEnabled.set(isEditMode ? false : true);
        this.prompt.set('');
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

  protected onAiToggle(checked: boolean): void {
    if (this.loading()) return;
    this.aiEnabled.set(checked);
  }

  protected onCreateProjectOnlyClick(): void {
    if (this.createOnlyDisabled()) return;
    this.createProjectOnly.emit({
      name: this.projectName().trim(),
      description: this.description().trim(),
    });
  }

  protected onPrimaryClick(): void {
    if (this.primaryDisabled()) return;
    const name = this.projectName().trim();
    const description = this.description().trim();
    if (this.isEditMode()) {
      this.saveProject.emit({ name, description });
      return;
    }

    if (this.aiEnabled()) {
      this.createProjectAndEndpoint.emit({
        name,
        description,
        endpointPrompt: this.prompt().trim(),
      });
    } else {
      this.createProjectOnly.emit({ name, description });
    }
  }
}
