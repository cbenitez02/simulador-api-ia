import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LucideArrowLeft, LucideArrowRight, LucideCircleCheck, LucideRoute } from '@lucide/angular';
import { ApiError } from '../../../../shared/http/api-error.mapper';
import type { EndpointPreview, HttpMethod } from '../../../../shared/models/endpoint-preview.model';
import { HTTP_METHOD_SELECT_OPTIONS } from '../../../../shared/constants/http-method-select-options';
import type { CreateEndpointStep, EndpointDraft } from '../../models/endpoint-draft.model';
import { EndpointAiGeneratorService } from '../../services/endpoint-ai-generator.service';
import { endpointPreviewToDraft, statusCodeForMethod } from '../../services/endpoint-draft.mapper';
import { CreateEndpointEditorStepComponent } from '../create-endpoint-editor-step/create-endpoint-editor-step.component';
import { CreateEndpointPromptStepComponent } from '../create-endpoint-prompt-step/create-endpoint-prompt-step.component';
import { CreateEndpointReviewStepComponent } from '../create-endpoint-review-step/create-endpoint-review-step.component';
import { EndpointsRepository } from '../../data-access/endpoints.repository';
import { InlineAlertComponent } from '../../../../shared/ui/inline-alert/inline-alert.component';

function normalizeReviewRoute(raw: string): string {
  let t = raw.trim();
  if (!t) return '/resource';
  if (!t.startsWith('/')) t = `/${t}`;
  return t.replace(/\/+$/, '') || '/';
}

@Component({
  selector: 'app-create-endpoint-page',
  standalone: true,
  templateUrl: './create-endpoint-page.component.html',
  styleUrls: ['./create-endpoint-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CreateEndpointEditorStepComponent,
    CreateEndpointPromptStepComponent,
    CreateEndpointReviewStepComponent,
    InlineAlertComponent,
    LucideArrowLeft,
    LucideArrowRight,
    LucideCircleCheck,
    LucideRoute,
  ],
})
export class CreateEndpointPageComponent {
  private readonly ai = inject(EndpointAiGeneratorService);
  private readonly endpointsRepository = inject(EndpointsRepository);
  private generationRequestId = 0;

  readonly open = input(false);
  readonly projectId = input<string | null>(null);
  readonly initialEndpoint = input<EndpointPreview | null>(null);
  readonly isEditing = input(false);
  /** Mock base URL for the preview tab (e.g. https://mock.apisim.dev/v1). */
  readonly apiBaseUrl = input('');

  readonly saved = output<EndpointPreview>();
  readonly cancelled = output<void>();

  protected readonly methodOptions = HTTP_METHOD_SELECT_OPTIONS;

  protected readonly step = signal<CreateEndpointStep>('prompt');
  protected readonly promptText = signal('');
  protected readonly promptError = signal<string | null>(null);
  protected readonly generationError = signal<string | null>(null);
  protected readonly generating = signal(false);

  protected readonly reviewMethod = signal<HttpMethod>('GET');
  protected readonly reviewRoute = signal('');
  /** Original user prompt shown in the editor metadata bar. */
  protected readonly sourcePrompt = signal('');

  protected readonly draft = signal<EndpointDraft | null>(null);
  protected readonly editingEndpointId = signal<string | null>(null);
  protected readonly loadingDraft = signal(false);
  protected readonly loadingError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly wizardSubtitle = computed(() => {
    if (this.isEditing()) return 'Configure endpoint';
    switch (this.step()) {
      case 'prompt':
        return 'Describe your endpoint';
      case 'review':
        return 'Review basics';
      case 'editor':
        return 'Configure endpoint';
      default:
        return '';
    }
  });

  /** 1-based index for the header stepper. */
  protected readonly wizardStepIndex = computed(() => {
    if (this.isEditing()) return 3;
    switch (this.step()) {
      case 'prompt':
        return 1;
      case 'review':
        return 2;
      case 'editor':
        return 3;
      default:
        return 1;
    }
  });

  private lastOpen = false;

  constructor() {
    effect(() => {
      const o = this.open();
      if (o && !this.lastOpen) {
        untracked(() => this.bootstrapSession());
      }
      this.lastOpen = o;
    });
  }

  private bootstrapSession(): void {
    const ep = this.initialEndpoint();
    this.loadingError.set(null);
    this.saveError.set(null);
    if (ep && this.projectId()) {
      this.editingEndpointId.set(ep.id);
      void this.hydrateDraft(this.projectId()!, ep);
    } else {
      this.editingEndpointId.set(null);
      this.resetCreateFlow();
    }
  }

  private resetCreateFlow(): void {
    this.step.set('prompt');
    this.promptText.set('');
    this.promptError.set(null);
    this.generationError.set(null);
    this.generating.set(false);
    this.draft.set(null);
    this.reviewMethod.set('GET');
    this.reviewRoute.set('');
    this.sourcePrompt.set('');
  }

  protected stepComplete(stepNum: number): boolean {
    return this.wizardStepIndex() > stepNum;
  }

  protected stepActiveDot(stepNum: number): boolean {
    return this.wizardStepIndex() === stepNum;
  }

  protected onPromptTextChange(v: string): void {
    this.promptText.set(v);
    if (v.trim()) this.promptError.set(null);
  }

  protected async onGenerateRequested(): Promise<void> {
    if (this.generating()) return;
    this.generationError.set(null);
    this.promptError.set(null);
    const projectId = this.projectId();
    const text = this.promptText().trim();
    if (!text) {
      this.promptError.set('Describe your endpoint in a sentence or two so we can infer method, route, and JSON.');
      return;
    }
    if (!projectId) {
      this.generationError.set('Select a project before generating an AI endpoint preview.');
      return;
    }

    const requestId = ++this.generationRequestId;
    this.generating.set(true);
    try {
      const d = await this.ai.generateFromPrompt(projectId, text);
      if (requestId !== this.generationRequestId) {
        return;
      }

      this.draft.set(d);
      this.reviewMethod.set(d.method);
      this.reviewRoute.set(d.route);
      this.sourcePrompt.set(text);
      this.step.set('review');
    } catch (error) {
      if (requestId !== this.generationRequestId) {
        return;
      }

      this.generationError.set(this.mapGenerationError(error));
    } finally {
      if (requestId === this.generationRequestId) {
        this.generating.set(false);
      }
    }
  }

  protected onReviewMethodChange(m: HttpMethod): void {
    this.reviewMethod.set(m);
  }

  protected onReviewRouteChange(r: string): void {
    this.reviewRoute.set(r);
  }

  protected backToPrompt(): void {
    if (this.saving()) return;
    this.step.set('prompt');
  }

  protected continueFromReview(): void {
    const base = this.draft();
    if (!base) {
      this.generationError.set('Generate an endpoint first, then review the basics.');
      this.step.set('prompt');
      return;
    }
    const route = normalizeReviewRoute(this.reviewRoute());
    const method = this.reviewMethod();
    this.draft.set({
      ...base,
      method: base.locks.method ? base.method : method,
      route: base.locks.path ? base.route : route,
      statusCode: base.locks.method ? base.statusCode : statusCodeForMethod(method),
    });
    this.step.set('editor');
  }

  protected onEditorBack(): void {
    if (this.saving()) return;
    if (this.isEditing()) {
      this.cancelled.emit();
      return;
    }
    const d = this.draft();
    if (d) {
      this.reviewMethod.set(d.method);
      this.reviewRoute.set(d.route);
    }
    this.step.set('review');
  }

  protected onDraftChange(d: EndpointDraft): void {
    this.draft.set(d);
  }

  protected async saveEndpoint(): Promise<void> {
    if (this.saving()) return;
    const d = this.draft();
    const projectId = this.projectId();
    if (!d || !projectId) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const ep = await this.endpointsRepository.saveEndpoint(projectId, d, this.editingEndpointId());
      this.saved.emit(ep);
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'Could not save endpoint.');
    } finally {
      this.saving.set(false);
    }
  }

  protected cancel(): void {
    if (this.saving()) return;

    if (this.generating()) {
      this.generationRequestId += 1;
      this.generating.set(false);
      this.resetCreateFlow();
    }

    this.cancelled.emit();
  }

  protected canSave(): boolean {
    return this.step() === 'editor' && this.draft() !== null && !this.loadingDraft() && !this.saving();
  }

  private async hydrateDraft(projectId: string, preview: EndpointPreview): Promise<void> {
    this.loadingDraft.set(true);
    this.loadingError.set(null);
    try {
      const draft = await this.endpointsRepository.loadDraft(projectId, preview.id);
      this.draft.set(draft);
      this.step.set('editor');
      this.promptText.set('');
      this.promptError.set(null);
      this.generationError.set(null);
      this.sourcePrompt.set(preview.description || '—');
    } catch {
      this.draft.set(endpointPreviewToDraft(preview));
      this.step.set('editor');
      this.sourcePrompt.set(preview.description || '—');
      this.loadingError.set('We could not load the full backend draft. You can still edit the fallback data.');
    } finally {
      this.loadingDraft.set(false);
    }
  }

  private mapGenerationError(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.code === 'AI_TIMEOUT' || error.status === 504) {
        return 'AI timed out before it could return a valid draft. Retry or continue manually.';
      }

      if (error.code === 'AI_UNAVAILABLE' || error.status === 503) {
        return 'AI is unavailable right now. Retry in a moment or continue manually.';
      }

      if (error.code === 'AI_INVALID_OUTPUT' || error.status === 422) {
        return 'AI returned an invalid draft. Retry with a more explicit prompt or continue manually.';
      }
    }

    return 'Something went wrong while generating. Try again or add an explicit path like /users.';
  }
}
