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
import { LucideRadio, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { LogsListComponent } from './components/logs-list/logs-list.component';
import type { ApiLogEntry } from './models/api-log.model';
import type { HttpMethod } from '../../shared/models/endpoint-preview.model';
import { LogsRepository } from './data-access/logs.repository';

type MethodFilter = 'all' | HttpMethod;
type StatusBand = 'all' | '2xx' | '4xx' | '5xx';

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.css'],
  standalone: true,
  imports: [LogsListComponent, LucideRadio, LucideSearch, LucideTrash2],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsComponent {
  private readonly logsRepository = inject(LogsRepository);
  /** Workspace project; drives which mock log lines are shown. */
  readonly projectId = input.required<string>();

  /** Sincronizado con el panel derecho del dashboard (mismo patrón que endpoints). */
  readonly selectedLog = model<ApiLogEntry | null>(null);

  protected readonly entries = signal<ApiLogEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly methodFilter = signal<MethodFilter>('all');
  protected readonly statusFilter = signal<StatusBand>('all');
  protected readonly endpointFilter = signal<string>('all');
  protected readonly live = signal(true);

  protected readonly selectedId = computed(() => this.selectedLog()?.id ?? null);

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
      void untracked(async () => this.loadLogs(pid));
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

  protected clearLogs(): void {
    void this.clearRemoteLogs();
  }

  protected toggleLive(): void {
    this.live.update((v) => !v);
  }

  protected retry(): void {
    void this.loadLogs(this.projectId());
  }

  private async loadLogs(projectId: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const entries = await this.logsRepository.listLogs(projectId);
      this.entries.set(entries);
      this.searchQuery.set('');
      this.methodFilter.set('all');
      this.statusFilter.set('all');
      this.endpointFilter.set('all');
    } catch (error) {
      this.entries.set([]);
      this.selectedLog.set(null);
      this.errorMessage.set(error instanceof Error ? error.message : 'Could not load logs.');
    } finally {
      this.loading.set(false);
    }
  }

  private async clearRemoteLogs(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      await this.logsRepository.clearLogs(this.projectId());
      this.entries.set([]);
      this.selectedLog.set(null);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Could not clear logs.');
    } finally {
      this.loading.set(false);
    }
  }
}
