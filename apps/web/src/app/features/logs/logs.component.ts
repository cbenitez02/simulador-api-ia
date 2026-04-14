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
import type { ApiLogCursor, ApiLogEntry, ListLogsQuery } from './models/api-log.model';
import type { HttpMethod } from '../../shared/models/endpoint-preview.model';
import { LogsRepository } from './data-access/logs.repository';

type MethodFilter = 'all' | HttpMethod;
type StatusBand = 'all' | '2xx' | '3xx' | '4xx' | '5xx';
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

function toCursor(entry: ApiLogEntry | null): ApiLogCursor | null {
  return entry ? { createdAt: entry.createdAt, id: entry.id } : null;
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
  private olderLoadInFlight = false;

  /** Workspace project; drives which mock log lines are shown. */
  readonly projectId = input('');

  /** Sincronizado con el panel derecho del dashboard (mismo patrón que endpoints). */
  readonly selectedLog = model<ApiLogEntry | null>(null);

  protected readonly entries = signal<ApiLogEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadingOlder = signal(false);
  protected readonly requestErrorMessage = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly methodFilter = signal<MethodFilter>('all');
  protected readonly statusFilter = signal<StatusBand>('all');
  protected readonly endpointFilter = signal<string>('all');
  protected readonly liveStatus = signal<LiveStatus>('off');
  protected readonly lastSuccessfulUpdate = signal<string | null>(null);
  protected readonly clearConfirmOpen = signal(false);
  protected readonly olderHistoryAvailable = signal(false);
  private readonly newerCursor = signal<ApiLogCursor | null>(null);
  private readonly olderCursor = signal<ApiLogCursor | null>(null);

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
    const paths = new Set(this.entries().map((entry) => entry.path));
    return [...paths].sort((left, right) => left.localeCompare(right));
  });

  protected readonly filteredEntries = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    return this.entries().filter((entry) => {
      if (!query) {
        return true;
      }

      return entry.path.toLowerCase().includes(query) || String(entry.statusCode).includes(query);
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
      const selection = this.selectedLog();
      const entries = this.entries();

      untracked(() => {
        if (selection && !entries.some((entry) => entry.id === selection.id)) {
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
    const value = (ev.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  protected onMethodChange(ev: Event): void {
    const value = (ev.target as HTMLSelectElement).value as MethodFilter;
    this.methodFilter.set(value);
    void this.reloadForServerFilters();
  }

  protected onStatusChange(ev: Event): void {
    const value = (ev.target as HTMLSelectElement).value as StatusBand;
    this.statusFilter.set(value);
    void this.reloadForServerFilters();
  }

  protected onEndpointChange(ev: Event): void {
    const value = (ev.target as HTMLSelectElement).value;
    this.endpointFilter.set(value);
    void this.reloadForServerFilters();
  }

  protected selectEntry(id: string): void {
    const entry = this.entries().find((candidate) => candidate.id === id) ?? null;
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

  protected loadOlderLogs(): void {
    void this.loadOlderProjectLogs();
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

  private buildBaseQuery(): ListLogsQuery {
    const method = this.methodFilter();
    const statusBucket = this.statusFilter();
    const path = this.endpointFilter();

    return {
      ...(method !== 'all' ? { method } : {}),
      ...(statusBucket !== 'all' ? { statusBucket } : {}),
      ...(path !== 'all' ? { path } : {}),
    };
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
    this.newerCursor.set(null);
    this.olderCursor.set(null);
    this.olderHistoryAvailable.set(false);
    this.lastSuccessfulUpdate.set(null);
    await this.loadLogs(projectId, false);
  }

  private async reloadForServerFilters(): Promise<void> {
    const projectId = this.projectId();

    if (!projectId) {
      return;
    }

    await this.loadLogs(projectId, true);
  }

  private async loadLogs(projectId: string, preserveContext: boolean): Promise<void> {
    this.loading.set(true);
    this.requestErrorMessage.set(null);

    const previousSelection = preserveContext ? this.selectedLog() : null;

    try {
      const response = await this.logsRepository.listLogs(projectId, this.buildBaseQuery());
      this.entries.set(response.items);
      this.newerCursor.set(toCursor(response.items[0] ?? null));
      this.olderCursor.set(response.nextCursor);
      this.olderHistoryAvailable.set(response.items.length > 0);
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

  private async loadOlderProjectLogs(): Promise<void> {
    const projectId = this.projectId();
    const cursor = this.olderCursor();

    if (!projectId || !cursor || this.loading() || this.olderLoadInFlight || !this.olderHistoryAvailable()) {
      return;
    }

    this.olderLoadInFlight = true;
    this.loadingOlder.set(true);
    this.requestErrorMessage.set(null);

    try {
      const response = await this.logsRepository.listLogs(projectId, {
        ...this.buildBaseQuery(),
        direction: 'older',
        cursorCreatedAt: cursor.createdAt,
        cursorId: cursor.id,
      });

      const mergedEntries = mergeEntries(this.entries(), response.items);
      this.entries.set(mergedEntries);
      this.newerCursor.set(toCursor(mergedEntries[0] ?? null));
      this.olderCursor.set(response.nextCursor);
      this.olderHistoryAvailable.set(response.items.length > 0);
      this.lastSuccessfulUpdate.set(response.serverTime);
      this.selectedLog.set(reconcileSelection(this.selectedLog(), mergedEntries));
    } catch (error) {
      this.requestErrorMessage.set(error instanceof Error ? error.message : 'Could not load older logs.');
    } finally {
      this.loadingOlder.set(false);
      this.olderLoadInFlight = false;
    }
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
    const cursor = this.newerCursor();

    if (!projectId || this.liveStatus() !== 'live' || this.pollInFlight) {
      return;
    }

    this.pollInFlight = true;

    try {
      const response = await this.logsRepository.listLogs(projectId, {
        ...this.buildBaseQuery(),
        ...(cursor
          ? {
              direction: 'newer',
              cursorCreatedAt: cursor.createdAt,
              cursorId: cursor.id,
            }
          : {}),
      });

      const mergedEntries = mergeEntries(this.entries(), response.items);
      this.entries.set(mergedEntries);
      this.newerCursor.set(response.nextCursor ?? this.newerCursor() ?? toCursor(mergedEntries[0] ?? null));
      this.olderCursor.set(this.olderCursor() ?? toCursor(mergedEntries.at(-1) ?? null));
      this.olderHistoryAvailable.set(
        mergedEntries.length > 0 && (this.olderHistoryAvailable() || response.items.length > 0),
      );
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
      this.newerCursor.set(null);
      this.olderCursor.set(null);
      this.olderHistoryAvailable.set(false);
      this.lastSuccessfulUpdate.set(new Date().toISOString());
      this.clearConfirmOpen.set(false);
    } catch (error) {
      this.requestErrorMessage.set(error instanceof Error ? error.message : 'Could not clear logs.');
    } finally {
      this.loading.set(false);
    }
  }
}
