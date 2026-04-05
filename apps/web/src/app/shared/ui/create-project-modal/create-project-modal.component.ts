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

import { ToggleSwitchComponent } from '../toggle-switch/toggle-switch.component';
import type { CreateProjectModalPayload, CreateProjectWithEndpointPayload } from './create-project-modal.model';

let createProjectModalUid = 0;

@Component({
  selector: 'app-create-project-modal',
  standalone: true,
  imports: [LucideLoader2, LucideSparkles, ToggleSwitchComponent],
  templateUrl: './create-project-modal.component.html',
  styleUrls: ['./create-project-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateProjectModalComponent {
  readonly open = input(false);
  /** When true, primary action shows “Generating…” and all controls are disabled. */
  readonly loading = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly cancelled = output<void>();
  readonly createProjectOnly = output<CreateProjectModalPayload>();
  readonly createProjectAndEndpoint = output<CreateProjectWithEndpointPayload>();

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

  protected readonly actionsDisabled = computed(() => this.loading());

  protected readonly primaryDisabled = computed(() => {
    if (this.loading()) return true;
    const name = this.projectName().trim();
    if (!name) return true;
    if (this.aiEnabled() && !this.prompt().trim()) return true;
    return false;
  });

  protected readonly createOnlyDisabled = computed(() => this.loading() || !this.projectName().trim());

  protected readonly primaryLabel = computed(() => {
    if (this.loading()) return 'Generating...';
    return this.aiEnabled() ? 'Create project & endpoint' : 'Create project';
  });

  constructor() {
    let prevOpen = false;
    effect(() => {
      const isOpen = this.open();
      if (isOpen && !prevOpen) {
        this.projectName.set('');
        this.description.set('');
        this.aiEnabled.set(true);
        this.prompt.set('');
      }
      prevOpen = isOpen;
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
