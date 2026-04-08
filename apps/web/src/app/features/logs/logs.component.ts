import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { LucidePause, LucidePlay, LucideRadio, LucideRefreshCw, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { LogsListComponent } from './components/logs-list/logs-list.component';
import type { ApiLogCursor, ApiLogEntry } from './models/api-log.model';
import type { HttpMethod } from '../../shared/models/endpoint-preview.model';
import { LogsRepository } from './data-access/logs.repository';

type MethodFilter = 'all' | HttpMethod;
type StatusBand = 'all' | '2xx' | '4xx' | '5xx';
type LiveStatus = 'off' | 'live' | 'paused';

const LIVE_POLL_INTERVAL_MS = 5000;

function compareEntries(left: ApiLogEntry, right: ApiLogEntry): number {
  const timeDelta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

  if (timeDelta !== 0) {
    return timeDelta;
  }

  return right.id.localeCompare(left.id);
}

function mergeEntries(current: ApiLogEntry[], incoming: ApiLogEntry[]): ApiLogEntry[] {
  const byId = new Map(current.map((entry) => [entry.id, entry]));

  for (const entry of incoming) {
    byId.set(entry.id, entry);
  }

  return [...byId.values()].sort(compareEntries);
}

function reconcileSelection(selected: ApiLogEntry | null, entries: ApiLogEntry[]): ApiLogEntry | null {
  if (!selected) {
    return null;
  }

  return entries.find((entry) => entry.id === selected.id) ?? null;
}

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.css'],
  standalone: true,
  imports: [LogsListComponent, LucidePause, LucidePlay, LucideRadio, LucideRefreshCw, LucideSearch, LucideTrash2],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsComponent {
  private readonly logsRepository = inject(LogsRepository);
  private liveIntervalId: ReturnType<typeof setInterval> | null = null;
  private activeProjectId: string | null = null;
  private pollInFlight = false;

  /** Workspace project; drives which mock log lines are shown. */
  readonly projectId = input('');

  /** Sincronizado con el panel derecho del dashboard (mismo patrón que endpoints). */
  readonly selectedLog = model<ApiLogEntry | null>(null);

  protected readonly entries = signal<ApiLogEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly requestErrorMessage = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly methodFilter = signal<MethodFilter>('all');
  protected readonly statusFilter = signal<StatusBand>('all');
  protected readonly endpointFilter = signal<string>('all');
  protected readonly liveStatus = signal<LiveStatus>('off');
  protected readonly lastSuccessfulUpdate = signal<string | null>(null);
  protected readonly clearConfirmOpen = signal(false);
  private readonly latestCursor = signal<ApiLogCursor | null>(null);

  protected readonly selectedId = computed(() => this.selectedLog()?.id ?? null);
  protected readonly liveActive = computed(() => this.liveStatus() === 'live');
  protected readonly hasActiveFilters = computed(
    () =>
      this.searchQuery().trim().length > 0 ||
      this.methodFilter() !== 'all' ||
      this.statusFilter() !== 'all' ||
      this.endpointFilter() !== 'all',
  );

  protected readonly endpointOptions = computed(() => {
    const paths = new Set(this.entries().map((e) => e.path));
    return [...paths].sort((a, b) => a.localeCompare(b));
  });

  protected readonly filteredEntries = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const mf = this.methodFilter();
    const sf = this.statusFilter();
    const ef = this.endpointFilter();

    return this.entries().filter((e) => {
      if (mf !== 'all' && e.method !== mf) return false;
      if (ef !== 'all' && e.path !== ef) return false;
      if (sf !== 'all') {
        const c = e.statusCode;
        if (sf === '2xx' && (c < 200 || c >= 300)) return false;
        if (sf === '4xx' && (c < 400 || c >= 500)) return false;
        if (sf === '5xx' && (c < 500 || c >= 600)) return false;
      }
      if (q) {
        const pathMatch = e.path.toLowerCase().includes(q);
        const statusMatch = String(e.statusCode).includes(q);
        if (!pathMatch && !statusMatch) return false;
      }
      return true;
    });
  });

  constructor() {
    effect(() => {
      const pid = this.projectId();

      if (!pid || pid === this.activeProjectId) {
        return;
      }

      this.activeProjectId = pid;
      void untracked(async () => this.loadProject(pid));
    });

    effect(() => {
      const sel = this.selectedLog();
      const filtered = this.filteredEntries();
      untracked(() => {
        if (sel && !filtered.some((e) => e.id === sel.id)) {
          this.selectedLog.set(null);
        }
      });
    });
  }

  protected readonly emptyStateMessage = computed(() => {
    if (this.hasActiveFilters()) {
      return 'No log entries match your current filters.';
    }

    return 'No logs yet for this project.';
  });

  protected onSearchInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.searchQuery.set(v);
  }

  protected onMethodChange(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value as MethodFilter;
    this.methodFilter.set(v);
  }

  protected onStatusChange(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value as StatusBand;
    this.statusFilter.set(v);
  }

  protected onEndpointChange(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.endpointFilter.set(v);
  }

  protected selectEntry(id: string): void {
    const entry = this.entries().find((e) => e.id === id) ?? null;
    this.selectedLog.set(entry);
  }

  protected startLive(): void {
    if (this.liveStatus() === 'live') {
      return;
    }

    this.liveStatus.set('live');
    this.startPolling();
  }

  protected pauseLive(): void {
    this.liveStatus.set('paused');
    this.stopPolling();
  }

  protected resumeLive(): void {
    this.liveStatus.set('live');
    this.startPolling();
  }

  protected refreshLogs(): void {
    void this.refreshProjectLogs();
  }

  protected retry(): void {
    void this.refreshProjectLogs();
  }

  protected requestClearLogs(): void {
    this.clearConfirmOpen.set(true);
  }

  protected cancelClearLogs(): void {
    this.clearConfirmOpen.set(false);
  }

  protected confirmClearLogs(): void {
    void this.clearRemoteLogs();
  }

  private async loadProject(projectId: string): Promise<void> {
    this.stopPolling();
    this.liveStatus.set('off');
    this.clearConfirmOpen.set(false);
    this.searchQuery.set('');
    this.methodFilter.set('all');
    this.statusFilter.set('all');
    this.endpointFilter.set('all');
    this.selectedLog.set(null);
    this.entries.set([]);
    this.latestCursor.set(null);
    this.lastSuccessfulUpdate.set(null);
    await this.loadLogs(projectId, false);
  }

  private async loadLogs(projectId: string, preserveContext: boolean): Promise<void> {
    this.loading.set(true);
    this.requestErrorMessage.set(null);

    const previousSelection = preserveContext ? this.selectedLog() : null;

    try {
      const response = await this.logsRepository.listLogs(projectId);
      this.entries.set(response.items);
      this.latestCursor.set(response.nextCursor);
      this.lastSuccessfulUpdate.set(response.serverTime);

      if (preserveContext) {
        this.selectedLog.set(reconcileSelection(previousSelection, response.items));
      }
    } catch (error) {
      if (!preserveContext) {
        this.entries.set([]);
        this.selectedLog.set(null);
      }

      this.requestErrorMessage.set(error instanceof Error ? error.message : 'Could not load logs.');
    } finally {
      this.loading.set(false);
    }
  }

  private async refreshProjectLogs(): Promise<void> {
    const projectId = this.projectId();

    if (!projectId) {
      return;
    }

    await this.loadLogs(projectId, true);
  }

  private startPolling(): void {
    this.stopPolling();

    this.liveIntervalId = setInterval(() => {
      void this.pollForNewLogs();
    }, LIVE_POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.liveIntervalId !== null) {
      clearInterval(this.liveIntervalId);
      this.liveIntervalId = null;
    }
  }

  private async pollForNewLogs(): Promise<void> {
    const projectId = this.projectId();
    const cursor = this.latestCursor();

    if (!projectId || this.liveStatus() !== 'live' || this.pollInFlight || !cursor) {
      return;
    }

    this.pollInFlight = true;

    try {
      const response = await this.logsRepository.listLogs(projectId, {
        cursorCreatedAt: cursor.createdAt,
        cursorId: cursor.id,
      });

      const mergedEntries = mergeEntries(this.entries(), response.items);
      this.entries.set(mergedEntries);
      this.latestCursor.set(response.nextCursor ?? this.latestCursor());
      this.lastSuccessfulUpdate.set(response.serverTime);
      this.selectedLog.set(reconcileSelection(this.selectedLog(), mergedEntries));
      this.requestErrorMessage.set(null);
    } catch (error) {
      this.requestErrorMessage.set(error instanceof Error ? error.message : 'Could not load logs.');
    } finally {
      this.pollInFlight = false;
    }
  }

  private async clearRemoteLogs(): Promise<void> {
    this.loading.set(true);
    this.requestErrorMessage.set(null);
    try {
      await this.logsRepository.clearLogs(this.projectId());
      this.entries.set([]);
      this.selectedLog.set(null);
      this.latestCursor.set(null);
      this.lastSuccessfulUpdate.set(new Date().toISOString());
      this.clearConfirmOpen.set(false);
    } catch (error) {
      this.requestErrorMessage.set(error instanceof Error ? error.message : 'Could not clear logs.');
    } finally {
      this.loading.set(false);
    }
  }
}
