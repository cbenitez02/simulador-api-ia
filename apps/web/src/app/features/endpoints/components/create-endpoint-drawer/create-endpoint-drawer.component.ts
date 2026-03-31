import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LucideLoader2, LucideSparkles, LucideX } from '@lucide/angular';
import type { EndpointPreview, HttpMethod } from '../../../../shared/models/endpoint-preview.model';
import type { EndpointConfig } from '../../../../shared/models/endpoint-config.model';
import type { MockScenarioId } from '../../../../shared/models/mock-scenario.model';
import { HttpMethodBadgeComponent } from '../../../../shared/ui/http-method-badge/http-method-badge.component';
import { JsonLineHighlightPipe } from '../../../../shared/pipes/json-line-highlight.pipe';
import { SelectMenuComponent, type SelectMenuOption } from '../../../../shared/ui/select-menu/select-menu.component';
import { mockAiResponseBody } from './mock-ai-response';

type CreationMode = 'ai' | 'manual';
type WizardStep = 'define' | 'configure';

const HTTP_METHOD_OPTIONS: SelectMenuOption[] = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
];

const SCENARIO_IDS: MockScenarioId[] = ['success', 'empty', 'error', 'timeout'];

const DEFAULT_SCENARIOS: Record<MockScenarioId, boolean> = {
  success: true,
  empty: false,
  error: false,
  timeout: false,
};

function normalizePath(raw: string): string {
  const t = raw.trim();
  if (!t) return '/';
  return t.startsWith('/') ? t : `/${t}`;
}

function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `ep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

@Component({
  selector: 'app-create-endpoint-drawer',
  standalone: true,
  templateUrl: './create-endpoint-drawer.component.html',
  styleUrls: ['./create-endpoint-drawer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HttpMethodBadgeComponent,
    JsonLineHighlightPipe,
    LucideLoader2,
    LucideSparkles,
    LucideX,
    SelectMenuComponent,
  ],
})
export class CreateEndpointDrawerComponent {
  readonly open = input(false);
  /** When set while opening, the drawer loads this endpoint for editing. */
  readonly initialEndpoint = input<EndpointPreview | null>(null);

  readonly dismiss = output<void>();
  readonly saved = output<EndpointPreview>();

  protected readonly isEditing = computed(() => this.initialEndpoint() !== null);

  protected readonly methodOptions = HTTP_METHOD_OPTIONS;

  protected readonly httpMethod = signal<HttpMethod>('GET');
  protected readonly pathInput = signal('');
  protected readonly descriptionInput = signal('');

  protected readonly creationMode = signal<CreationMode>('ai');
  protected readonly wizardStep = signal<WizardStep>('define');

  protected readonly aiPrompt = signal('');
  protected readonly manualJsonText = signal('');
  protected readonly manualJsonError = signal<string | null>(null);

  protected readonly draftJson = signal<unknown | null>(null);
  protected readonly aiGenerating = signal(false);

  protected readonly latencyMs = signal(150);
  protected readonly errorRatePct = signal(0);
  protected readonly scenarioSuccess = signal(DEFAULT_SCENARIOS.success);
  protected readonly scenarioEmpty = signal(DEFAULT_SCENARIOS.empty);
  protected readonly scenarioError = signal(DEFAULT_SCENARIOS.error);
  protected readonly scenarioTimeout = signal(DEFAULT_SCENARIOS.timeout);

  protected readonly previewLines = signal<string[]>([]);

  private lastOpen = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (isOpen && !this.lastOpen) {
        untracked(() => {
          const initial = this.initialEndpoint();
          if (initial) {
            this.hydrateFromEndpoint(initial);
          } else {
            this.resetWizard();
          }
        });
      }
      this.lastOpen = isOpen;
    });

    effect(() => {
      const j = this.draftJson();
      untracked(() => {
        if (j === null) {
          this.previewLines.set([]);
          return;
        }
        try {
          const text = JSON.stringify(j, null, 2);
          this.previewLines.set(text.split('\n'));
        } catch {
          this.previewLines.set([String(j)]);
        }
      });
    });
  }

  protected onMethodChange(value: string): void {
    this.httpMethod.set(value as HttpMethod);
  }

  protected onPathInput(event: Event): void {
    this.pathInput.set((event.target as HTMLInputElement).value);
  }

  protected onDescriptionInput(event: Event): void {
    this.descriptionInput.set((event.target as HTMLTextAreaElement).value);
  }

  protected onAiPromptInput(event: Event): void {
    this.aiPrompt.set((event.target as HTMLTextAreaElement).value);
  }

  protected onManualJsonInput(event: Event): void {
    const v = (event.target as HTMLTextAreaElement).value;
    this.manualJsonText.set(v);
    this.validateManualJson(v);
  }

  protected selectCreationMode(mode: CreationMode): void {
    if (this.creationMode() === mode) return;
    this.creationMode.set(mode);
    if (this.wizardStep() !== 'define') return;

    this.manualJsonError.set(null);

    if (mode === 'manual') {
      const draft = this.draftJson();
      if (draft !== null && !this.manualJsonText().trim()) {
        try {
          this.manualJsonText.set(JSON.stringify(draft, null, 2));
        } catch {
          /* keep textarea as-is */
        }
      } else if (this.manualJsonText().trim()) {
        this.validateManualJson(this.manualJsonText());
      }
    }
  }

  protected validateManualJson(text: string): void {
    const t = text.trim();
    if (!t) {
      this.manualJsonError.set(null);
      this.draftJson.set(null);
      return;
    }
    try {
      const parsed = JSON.parse(t) as unknown;
      this.manualJsonError.set(null);
      this.draftJson.set(parsed);
    } catch {
      this.manualJsonError.set('Invalid JSON. Check brackets, quotes, and trailing commas.');
      this.draftJson.set(null);
    }
  }

  protected generateWithAi(): void {
    if (this.aiGenerating()) return;
    this.aiGenerating.set(true);
    const method = this.httpMethod();
    const path = normalizePath(this.pathInput());

    window.setTimeout(() => {
      const body = mockAiResponseBody(method, path);
      this.draftJson.set(body);
      this.aiGenerating.set(false);
      if (this.wizardStep() === 'define') {
        this.wizardStep.set('configure');
      }
    }, 900);
  }

  protected onLatencyInput(event: Event): void {
    this.latencyMs.set(Number((event.target as HTMLInputElement).value));
  }

  protected onErrorRateInput(event: Event): void {
    this.errorRatePct.set(Number((event.target as HTMLInputElement).value));
  }

  protected toggleScenario(id: MockScenarioId, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    switch (id) {
      case 'success':
        this.scenarioSuccess.set(checked);
        break;
      case 'empty':
        this.scenarioEmpty.set(checked);
        break;
      case 'error':
        this.scenarioError.set(checked);
        break;
      case 'timeout':
        this.scenarioTimeout.set(checked);
        break;
    }
  }

  protected scenarioChecked(id: MockScenarioId): boolean {
    switch (id) {
      case 'success':
        return this.scenarioSuccess();
      case 'empty':
        return this.scenarioEmpty();
      case 'error':
        return this.scenarioError();
      case 'timeout':
        return this.scenarioTimeout();
      default:
        return false;
    }
  }

  protected scenarioLabel(id: MockScenarioId): string {
    switch (id) {
      case 'success':
        return 'Success';
      case 'empty':
        return 'Empty';
      case 'error':
        return 'Error';
      case 'timeout':
        return 'Timeout';
    }
  }

  protected readonly scenarioIds = SCENARIO_IDS;

  protected close(): void {
    this.dismiss.emit();
  }

  protected cancel(): void {
    this.dismiss.emit();
  }

  protected submitSave(): void {
    const body = this.draftJson();
    if (!body) return;

    const path = normalizePath(this.pathInput());
    const method = this.httpMethod();
    const description = this.descriptionInput().trim() || 'No description';

    const scenarios: Record<MockScenarioId, boolean> = {
      success: this.scenarioSuccess(),
      empty: this.scenarioEmpty(),
      error: this.scenarioError(),
      timeout: this.scenarioTimeout(),
    };

    const latency = this.latencyMs();
    const errRate = this.errorRatePct();

    const config: EndpointConfig = {
      latencyMs: latency,
      errorRatePct: errRate,
      scenarios,
    };

    let statusCode = 200;
    if (method === 'POST') statusCode = 201;
    if (method === 'DELETE') statusCode = 204;

    const existing = this.initialEndpoint();
    const responseHeaders = existing?.responseHeaders ?? { 'content-type': 'application/json' };

    const ep: EndpointPreview = {
      id: existing?.id ?? newId(),
      method,
      path,
      description,
      latencyMs: latency,
      statusCode,
      responseBody: body,
      responseHeaders,
      config,
    };

    this.saved.emit(ep);
    this.dismiss.emit();
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open() || event.key !== 'Escape') return;
    event.preventDefault();
    this.dismiss.emit();
  }

  protected canContinueToConfigure(): boolean {
    return (
      this.wizardStep() === 'define' &&
      this.draftJson() !== null &&
      !this.aiGenerating() &&
      this.manualJsonError() === null
    );
  }

  protected continueToConfigure(): void {
    if (!this.canContinueToConfigure()) return;
    this.wizardStep.set('configure');
  }

  protected canSubmit(): boolean {
    return this.wizardStep() === 'configure' && this.draftJson() !== null && !this.aiGenerating();
  }

  protected goBackToDefine(): void {
    this.wizardStep.set('define');
    const mode = this.creationMode();
    const draft = this.draftJson();
    if (mode === 'manual' && draft !== null) {
      try {
        this.manualJsonText.set(JSON.stringify(draft, null, 2));
      } catch {
        /* keep previous textarea */
      }
    }
  }

  private hydrateFromEndpoint(ep: EndpointPreview): void {
    this.httpMethod.set(ep.method);
    this.pathInput.set(ep.path.replace(/^\//, '') || '/');
    this.descriptionInput.set(ep.description);
    this.creationMode.set('manual');
    this.wizardStep.set('define');
    this.aiPrompt.set('');
    this.manualJsonError.set(null);
    this.aiGenerating.set(false);
    try {
      const text = JSON.stringify(ep.responseBody, null, 2);
      this.manualJsonText.set(text);
    } catch {
      this.manualJsonText.set('');
    }
    this.draftJson.set(ep.responseBody);

    const cfg = ep.config;
    this.latencyMs.set(cfg?.latencyMs ?? ep.latencyMs);
    this.errorRatePct.set(cfg?.errorRatePct ?? 0);
    if (cfg?.scenarios) {
      this.scenarioSuccess.set(cfg.scenarios.success);
      this.scenarioEmpty.set(cfg.scenarios.empty);
      this.scenarioError.set(cfg.scenarios.error);
      this.scenarioTimeout.set(cfg.scenarios.timeout);
    } else {
      this.scenarioSuccess.set(DEFAULT_SCENARIOS.success);
      this.scenarioEmpty.set(DEFAULT_SCENARIOS.empty);
      this.scenarioError.set(DEFAULT_SCENARIOS.error);
      this.scenarioTimeout.set(DEFAULT_SCENARIOS.timeout);
    }
  }

  private resetWizard(): void {
    this.httpMethod.set('GET');
    this.pathInput.set('');
    this.descriptionInput.set('');
    this.creationMode.set('ai');
    this.wizardStep.set('define');
    this.aiPrompt.set('');
    this.manualJsonText.set('');
    this.manualJsonError.set(null);
    this.draftJson.set(null);
    this.aiGenerating.set(false);
    this.latencyMs.set(150);
    this.errorRatePct.set(0);
    this.scenarioSuccess.set(true);
    this.scenarioEmpty.set(false);
    this.scenarioError.set(false);
    this.scenarioTimeout.set(false);
  }
}
