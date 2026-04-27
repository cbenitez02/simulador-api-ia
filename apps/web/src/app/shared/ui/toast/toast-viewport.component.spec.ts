import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { resolveAngularExternalResources, setupAngularVitest } from '../../../testing/angular-vitest';
import { ToastViewportComponent } from './toast-viewport.component';
import { ToastService } from './toast.service';

setupAngularVitest();

describe('ToastViewportComponent', () => {
  it('renderiza el título del toast activo', async () => {
    await resolveAngularExternalResources();
    await TestBed.configureTestingModule({
      imports: [ToastViewportComponent],
    }).compileComponents();

    const toast = TestBed.inject(ToastService);
    toast.dismiss();
    toast.info('Hola desde prueba');

    const fixture = TestBed.createComponent(ToastViewportComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.toast__title')?.textContent?.trim()).toBe('Hola desde prueba');
  });
});
