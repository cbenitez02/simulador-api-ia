import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { HTTP_METHOD_SELECT_OPTIONS } from '../../../../shared/constants/http-method-select-options';
import type { HttpMethod } from '../../../../shared/models/endpoint-preview.model';
import { editorSourcePrompt, editMethodPathNotice } from '../../../../shared/utils/endpoint-flow-ui';
import { JsonLineHighlightPipe } from '../../../../shared/pipes/json-line-highlight.pipe';
import { displayRoute } from '../../../../shared/utils/display-route';
import { HttpMethodBadgeComponent } from '../../../../shared/ui/http-method-badge/http-method-badge.component';
import { IconTabStripComponent, type IconTabItem } from '../../../../shared/ui/icon-tab-strip/icon-tab-strip.component';
import { InlineAlertComponent } from '../../../../shared/ui/inline-alert/inline-alert.component';
import { LabeledRangeComponent } from '../../../../shared/ui/labeled-range/labeled-range.component';
import { PanelHeaderComponent } from '../../../../shared/ui/panel-header/panel-header.component';
import {
  SegmentedControlComponent,
  type SegmentedOption,
} from '../../../../shared/ui/segmented-control/segmented-control.component';
import { SelectMenuComponent, type SelectMenuOption } from '../../../../shared/ui/select-menu/select-menu.component';
import type { EndpointDraft, EndpointFlowMode, EndpointScenario, LatencyMode } from '../../models/endpoint-draft.model';
import { newScenarioId } from '../../models/endpoint-draft.model';
import { statusCodeForMethod } from '../../services/endpoint-draft.mapper';

export type EditorPanelTab = 'response' | 'scenarios' | 'behavior' | 'preview';

const LATENCY_MODE_OPTIONS: readonly SegmentedOption[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'range', label: 'Range' },
];

const SCENARIO_TYPE_OPTIONS: SelectMenuOption[] = [
  { value: 'success', label: 'success' },
  { value: 'empty', label: 'empty' },
  { value: 'error', label: 'error' },
  { value: 'timeout', label: 'timeout' },
  { value: 'custom', label: 'custom' },
];

function serializeBody(body: unknown): string {
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

function bodySignature(body: unknown): string {
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

@Component({
  selector: 'app-create-endpoint-editor-step',
  standalone: true,
  templateUrl: './create-endpoint-editor-step.component.html',
  styleUrls: ['./create-endpoint-editor-step.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HttpMethodBadgeComponent,
    IconTabStripComponent,
    InlineAlertComponent,
    JsonLineHighlightPipe,
    LabeledRangeComponent,
    PanelHeaderComponent,
    SegmentedControlComponent,
    SelectMenuComponent,
  ],
})
export class CreateEndpointEditorStepComponent {
  readonly draft = input.required<EndpointDraft>();
  readonly mode = input<EndpointFlowMode>('ai');
  /** Shown on the right of the metadata bar (original NL prompt). */
  readonly sourcePrompt = input('');
  /** Base URL for the Preview tab request line. */
  readonly apiBaseUrl = input('');

  readonly draftChange = output<EndpointDraft>();

  protected readonly methodOptions = HTTP_METHOD_SELECT_OPTIONS;
  protected readonly latencyModeOptions = LATENCY_MODE_OPTIONS;
  protected readonly scenarioTypeOptions = SCENARIO_TYPE_OPTIONS;
  protected readonly editMethodPathNotice = editMethodPathNotice;

  protected readonly editorTabs = computed<IconTabItem[]>(() => {
    const d = this.draft();
    return [
      { id: 'response', label: 'Response', icon: 'fileText' },
      { id: 'scenarios', label: 'Scenarios', icon: 'gitBranch', badge: d.scenarios.length },
      { id: 'behavior', label: 'Behavior', icon: 'sliders' },
      { id: 'preview', label: 'Preview', icon: 'eye' },
    ];
  });

  protected readonly activeTab = signal<EditorPanelTab>('response');

  protected readonly responseJsonText = signal('');
  private responseBodySerialized = '';

  protected readonly responseJsonError = signal<string | null>(null);
  protected readonly previewLines = signal<string[]>([]);
  private pendingScenarioScrollId: string | null = null;
  private pendingScenarioScrollAttempts = 0;

  constructor() {
    effect(() => {
      const d = this.draft();
      const sig = bodySignature(d.responseBody);
      if (sig !== this.responseBodySerialized) {
        this.responseBodySerialized = sig;
        untracked(() => {
          this.responseJsonText.set(serializeBody(d.responseBody));
          this.responseJsonError.set(null);
          this.refreshPreviewLines(d.responseBody);
        });
      }
    });
  }

  protected selectTab(tab: EditorPanelTab): void {
    this.activeTab.set(tab);
  }

  protected onEditorTabChange(id: string): void {
    this.selectTab(id as EditorPanelTab);
  }

  protected metadataLabel(): string {
    return editorSourcePrompt(this.mode(), this.sourcePrompt());
  }

  protected mockRequestLine(): string {
    const d = this.draft();
    const path = displayRoute(d.route);
    const base = this.apiBaseUrl().trim().replace(/\/$/, '');
    if (!base) return `${d.method} ${path}`;
    return `${d.method} ${base}${path}`;
  }

  protected previewLatencyLabel(): string {
    const b = this.draft().behavior;
    if (b.latencyMode === 'fixed') return `${b.fixedDelayMs}ms`;
    return `${b.minDelayMs}–${b.maxDelayMs}ms`;
  }

  protected onMethodChange(v: string): void {
    if (this.draft().locks.method) return;
    const method = v as HttpMethod;
    const d = this.draft();
    const statusCode = statusCodeForMethod(method);
    const scenarios = d.scenarios.map((s) => (s.type === 'success' ? { ...s, statusCode } : { ...s }));
    this.emit({
      ...d,
      method,
      statusCode,
      scenarios,
    });
  }

  protected onRouteInput(event: Event): void {
    if (this.draft().locks.path) return;
    const route = (event.target as HTMLInputElement).value;
    this.emit({ ...this.draft(), route });
  }

  protected onDescriptionInput(event: Event): void {
    this.emit({ ...this.draft(), description: (event.target as HTMLTextAreaElement).value });
  }

  protected onStatusCodeInput(event: Event): void {
    const n = Number((event.target as HTMLInputElement).value);
    this.emit({ ...this.draft(), statusCode: Number.isFinite(n) ? n : 200 });
  }

  protected onResponseJsonInput(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.responseJsonText.set(text);
    const t = text.trim();
    if (!t) {
      this.responseJsonError.set(null);
      return;
    }
    try {
      JSON.parse(t);
      this.responseJsonError.set(null);
    } catch {
      this.responseJsonError.set('Invalid JSON');
    }
  }

  protected formatResponseJson(): void {
    const text = this.responseJsonText();
    const t = text.trim();
    if (!t) return;
    try {
      const parsed = JSON.parse(t) as unknown;
      const pretty = JSON.stringify(parsed, null, 2);
      this.responseJsonText.set(pretty);
      this.applyResponseBody(parsed);
    } catch {
      this.responseJsonError.set('Cannot format until JSON is valid');
    }
  }

  protected commitResponseJson(): void {
    const text = this.responseJsonText().trim();
    if (!text) {
      this.applyResponseBody(null);
      return;
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      this.applyResponseBody(parsed);
    } catch {
      this.responseJsonError.set('Invalid JSON');
    }
  }

  private applyResponseBody(body: unknown): void {
    const d = this.draft();
    this.responseBodySerialized = bodySignature(body);
    const scenarios = d.scenarios.map((s) => (s.type === 'success' ? { ...s, body } : { ...s }));
    this.emit({ ...d, responseBody: body, scenarios });
    untracked(() => this.refreshPreviewLines(body));
  }

  protected onScenarioName(i: number, event: Event): void {
    this.patchScenario(i, { name: (event.target as HTMLInputElement).value });
  }

  protected onScenarioType(i: number, v: string): void {
    if (this.draft().locks.scenarioType) return;
    this.patchScenario(i, { type: v as EndpointScenario['type'] });
  }

  protected onScenarioStatus(i: number, event: Event): void {
    const n = Number((event.target as HTMLInputElement).value);
    this.patchScenario(i, { statusCode: Number.isFinite(n) ? n : 200 });
  }

  protected onScenarioDelay(i: number, event: Event): void {
    const n = Number((event.target as HTMLInputElement).value);
    this.patchScenario(i, { delayMs: Number.isFinite(n) ? Math.max(0, n) : 0 });
  }

  protected onScenarioWeight(i: number, event: Event): void {
    const n = Number((event.target as HTMLInputElement).value);
    this.patchScenario(i, { weight: Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0 });
  }

  protected onScenarioBodyBlur(i: number, event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value.trim();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        return;
      }
    }
    this.patchScenario(i, { body });
  }

  protected addScenario(): void {
    if (this.draft().locks.scenarioType) return;
    const d = this.draft();
    const row: EndpointScenario = {
      id: newScenarioId(),
      name: 'Custom',
      type: 'custom',
      statusCode: 200,
      body: { ok: true },
      delayMs: 0,
      weight: 10,
    };
    this.emit({ ...d, scenarios: [...d.scenarios, row] });
    this.queueScenarioScroll(row.id);
  }

  protected addPreset(kind: 'empty' | 'error' | 'timeout' | 'unauthorized'): void {
    if (this.draft().locks.scenarioType && kind === 'unauthorized') return;
    const d = this.draft();
    let row: EndpointScenario;
    switch (kind) {
      case 'empty':
        row = {
          id: newScenarioId(),
          name: 'Empty',
          type: 'empty',
          statusCode: d.method === 'DELETE' ? 204 : 200,
          body: d.method === 'DELETE' ? null : { data: [], meta: { total: 0 } },
          delayMs: 0,
          weight: 15,
        };
        break;
      case 'error':
        row = {
          id: newScenarioId(),
          name: 'Error',
          type: 'error',
          statusCode: 500,
          body: { error: 'Internal server error', message: 'Simulated failure' },
          delayMs: 0,
          weight: 10,
        };
        break;
      case 'timeout':
        row = {
          id: newScenarioId(),
          name: 'Timeout',
          type: 'timeout',
          statusCode: 408,
          body: { error: 'Request timeout' },
          delayMs: 8000,
          weight: 5,
        };
        break;
      default:
        row = {
          id: newScenarioId(),
          name: 'Unauthorized',
          type: 'custom',
          statusCode: 401,
          body: { error: 'Unauthorized', message: 'Invalid or missing token' },
          delayMs: 0,
          weight: 8,
        };
    }
    this.emit({ ...d, scenarios: [...d.scenarios, row] });
    this.queueScenarioScroll(row.id);
  }

  protected removeScenario(i: number): void {
    const d = this.draft();
    if (d.scenarios.length <= 1) return;
    const next = d.scenarios.filter((_, idx) => idx !== i);
    this.emit({ ...d, scenarios: next });
  }

  protected scenarioBodyText(s: EndpointScenario): string {
    return serializeBody(s.body);
  }

  protected onLatencyModeChange(mode: string): void {
    if (mode !== 'fixed' && mode !== 'range') return;
    const d = this.draft();
    this.emit({ ...d, behavior: { ...d.behavior, latencyMode: mode as LatencyMode } });
  }

  protected onFixedDelayValue(n: number): void {
    this.patchBehavior({ fixedDelayMs: Number.isFinite(n) ? Math.max(0, n) : 0 });
  }

  protected onMinDelayValue(n: number): void {
    this.patchBehavior({ minDelayMs: Number.isFinite(n) ? Math.max(0, n) : 0 });
  }

  protected onMaxDelayValue(n: number): void {
    this.patchBehavior({ maxDelayMs: Number.isFinite(n) ? Math.max(0, n) : 0 });
  }

  protected onErrorRateValue(n: number): void {
    this.patchBehavior({ errorRate: Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0 });
  }

  protected onUseWeights(event: Event): void {
    this.patchBehavior({ useScenarioWeights: (event.target as HTMLInputElement).checked });
  }

  private patchScenario(index: number, patch: Partial<EndpointScenario>): void {
    const d = this.draft();
    const scenarios = d.scenarios.map((s, idx) => (idx === index ? { ...s, ...patch } : s));
    this.emit({ ...d, scenarios });
  }

  private patchBehavior(patch: Partial<EndpointDraft['behavior']>): void {
    const d = this.draft();
    this.emit({ ...d, behavior: { ...d.behavior, ...patch } });
  }

  private emit(next: EndpointDraft): void {
    this.draftChange.emit(next);
  }

  private refreshPreviewLines(body: unknown): void {
    try {
      const text = JSON.stringify(body, null, 2);
      this.previewLines.set(text.split('\n'));
    } catch {
      this.previewLines.set([String(body)]);
    }
  }

  protected isSuccessScenario(s: EndpointScenario): boolean {
    return s.type === 'success';
  }

  protected scenarioTypeLocked(): boolean {
    return this.draft().locks.scenarioType;
  }

  private queueScenarioScroll(scenarioId: string): void {
    this.pendingScenarioScrollId = scenarioId;
    this.pendingScenarioScrollAttempts = 0;
    this.tryScrollToPendingScenario();
  }

  private tryScrollToPendingScenario(): void {
    const scenarioId = this.pendingScenarioScrollId;
    if (!scenarioId) return;
    const doc = globalThis.document;
    if (!doc) {
      this.pendingScenarioScrollId = null;
      return;
    }

    const target = doc.querySelector<HTMLElement>(`[data-scenario-id="${scenarioId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      this.pendingScenarioScrollId = null;
      return;
    }

    if (this.pendingScenarioScrollAttempts >= 8) {
      this.pendingScenarioScrollId = null;
      return;
    }

    this.pendingScenarioScrollAttempts += 1;
    globalThis.setTimeout(() => this.tryScrollToPendingScenario(), 40);
  }
}
