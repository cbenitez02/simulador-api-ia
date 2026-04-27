import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveAngularExternalResources, setupAngularVitest } from '../../../testing/angular-vitest';
import { ToastService } from './toast.service';

setupAngularVitest();

describe('ToastService', () => {
  beforeEach(async () => {
    await resolveAngularExternalResources();
    await TestBed.configureTestingModule({}).compileComponents();
    TestBed.inject(ToastService).dismiss();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(ToastService).dismiss();
  });

  it('apila un toast y lo cierra con dismiss(id)', () => {
    const service = TestBed.inject(ToastService);
    const id = service.success('Guardado');
    expect(service.toasts().map((t) => t.title)).toEqual(['Guardado']);
    service.dismiss(id);
    expect(service.toasts()).toEqual([]);
  });

  it('dismiss sin id vacía la cola', () => {
    const service = TestBed.inject(ToastService);
    service.show('a');
    service.show('b');
    expect(service.toasts().length).toBe(2);
    service.dismiss();
    expect(service.toasts()).toEqual([]);
  });

  it('promise reemplaza loading por success al resolver', async () => {
    const service = TestBed.inject(ToastService);
    service.promise(Promise.resolve(42), {
      loading: 'Procesando',
      success: (n) => `Listo: ${n}`,
      error: 'Falló',
    });
    expect(service.toasts()[0]?.title).toBe('Procesando');
    await Promise.resolve();
    await Promise.resolve();
    expect(service.toasts()[0]?.variant).toBe('success');
    expect(service.toasts()[0]?.title).toBe('Listo: 42');
  });

  it('promise reemplaza loading por error al rechazar', async () => {
    const service = TestBed.inject(ToastService);
    service.promise(Promise.reject(new Error('red')), {
      loading: 'Procesando',
      success: () => 'ok',
      error: (err) => (err instanceof Error ? err.message : 'x'),
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(service.toasts()[0]?.variant).toBe('error');
    expect(service.toasts()[0]?.title).toBe('red');
  });

  it('auto-dismiss tras duration con timers falsos', () => {
    vi.useFakeTimers();
    const service = TestBed.inject(ToastService);
    service.show('ephemeral', { duration: 1000 });
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(service.toasts().length).toBe(0);
  });
});
