import { Injectable, computed, signal } from '@angular/core';

import type { ToastItem, ToastOptions, ToastPromiseOptions, ToastVariant } from './toast.model';

const DEFAULT_DURATION_MS = 4000;
const MAX_VISIBLE = 5;

function newToastId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<ToastItem[]>([]);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Visible stack (newest last in DOM order = top of stack visually if column-reverse) */
  readonly toasts = computed(() => this.items());

  show(message: string, options?: ToastOptions): string {
    return this.pushToast('default', message, options);
  }

  success(message: string, options?: ToastOptions): string {
    return this.pushToast('success', message, options);
  }

  error(message: string, options?: ToastOptions): string {
    return this.pushToast('error', message, options);
  }

  info(message: string, options?: ToastOptions): string {
    return this.pushToast('info', message, options);
  }

  warning(message: string, options?: ToastOptions): string {
    return this.pushToast('warning', message, options);
  }

  dismiss(id?: string): void {
    if (id === undefined) {
      for (const item of this.items()) {
        this.clearTimer(item.id);
      }
      this.items.set([]);
      return;
    }
    this.clearTimer(id);
    this.items.update((list) => list.filter((t) => t.id !== id));
  }

  promise<T>(promiseOrFn: Promise<T> | (() => Promise<T>), options: ToastPromiseOptions<T>): void {
    const id = newToastId();
    const loadingItem: ToastItem = {
      id,
      title: options.loading,
      description: options.description,
      variant: 'default',
      duration: 0,
      createdAt: Date.now(),
    };
    this.upsertOrEnqueue(loadingItem);

    const run = typeof promiseOrFn === 'function' ? (promiseOrFn as () => Promise<T>)() : (promiseOrFn as Promise<T>);

    void run
      .then((data) => {
        const title = typeof options.success === 'function' ? options.success(data) : options.success;
        this.replaceToast(id, {
          id,
          title,
          description: options.description,
          variant: 'success',
          duration: DEFAULT_DURATION_MS,
          createdAt: Date.now(),
        });
      })
      .catch((err: unknown) => {
        const title = typeof options.error === 'function' ? options.error(err) : options.error;
        this.replaceToast(id, {
          id,
          title,
          description: options.description,
          variant: 'error',
          duration: DEFAULT_DURATION_MS,
          createdAt: Date.now(),
        });
      });
  }

  private pushToast(variant: ToastVariant, title: string, options?: ToastOptions): string {
    const id = options?.id ?? newToastId();
    const duration = options?.duration ?? DEFAULT_DURATION_MS;
    const item: ToastItem = {
      id,
      title,
      description: options?.description,
      variant,
      duration,
      action: options?.action,
      createdAt: Date.now(),
    };
    this.upsertOrEnqueue(item);
    if (duration > 0) {
      this.scheduleAutoDismiss(id, duration);
    }
    return id;
  }

  private replaceToast(id: string, next: ToastItem): void {
    this.clearTimer(id);
    this.items.update((list) => list.map((t) => (t.id === id ? next : t)));
    if (next.duration > 0) {
      this.scheduleAutoDismiss(id, next.duration);
    }
  }

  private upsertOrEnqueue(item: ToastItem): void {
    this.clearTimer(item.id);
    this.items.update((list) => {
      const without = list.filter((t) => t.id !== item.id);
      let next = [...without, item];
      if (next.length > MAX_VISIBLE) {
        const drop = next.length - MAX_VISIBLE;
        const removed = next.slice(0, drop);
        for (const r of removed) {
          this.clearTimer(r.id);
        }
        next = next.slice(drop);
      }
      return next;
    });
  }

  private scheduleAutoDismiss(id: string, duration: number): void {
    this.clearTimer(id);
    const handle = setTimeout(() => {
      this.timers.delete(id);
      this.dismiss(id);
    }, duration);
    this.timers.set(id, handle);
  }

  private clearTimer(id: string): void {
    const t = this.timers.get(id);
    if (t !== undefined) {
      clearTimeout(t);
      this.timers.delete(id);
    }
  }
}
