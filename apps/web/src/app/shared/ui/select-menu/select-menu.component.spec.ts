import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { resolveAngularExternalResources, setupAngularVitest } from '../../../testing/angular-vitest';
import { SelectMenuComponent } from './select-menu.component';

setupAngularVitest();

async function renderSelectMenu() {
  await resolveAngularExternalResources();
  await TestBed.configureTestingModule({
    imports: [SelectMenuComponent],
  }).compileComponents();

  const fixture = TestBed.createComponent(SelectMenuComponent);
  fixture.componentRef.setInput('options', [
    { value: 'viewer', label: 'Viewer' },
    { value: 'editor', label: 'Editor' },
    { value: 'owner', label: 'Owner' },
  ]);
  fixture.componentRef.setInput('value', 'viewer');
  fixture.componentRef.setInput('disabled', false);
  fixture.componentRef.setInput('triggerId', 'role-trigger');
  fixture.componentRef.setInput('listboxId', 'role-listbox');
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('SelectMenuComponent', () => {
  it('opens from the trigger, emits the picked value, and closes the panel', async () => {
    const fixture = await renderSelectMenu();
    const component = fixture.componentInstance;
    const emitSpy = vi.fn();
    component.valueChange.subscribe(emitSpy);

    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector<HTMLButtonElement>('#role-trigger');

    if (!trigger) {
      throw new Error('Select menu trigger not rendered');
    }

    trigger.click();
    fixture.detectChanges();

    const option = element.querySelectorAll<HTMLButtonElement>('#role-listbox .select-menu__option').item(1);

    option.click();
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledWith('editor');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('#role-listbox')).toBeNull();
  });

  it('closes the panel when a pointerdown happens outside the component', async () => {
    const fixture = await renderSelectMenu();
    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector<HTMLButtonElement>('#role-trigger');

    if (!trigger) {
      throw new Error('Select menu trigger not rendered');
    }

    trigger.click();
    fixture.detectChanges();
    expect(element.querySelector('#role-listbox')).not.toBeNull();

    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    fixture.detectChanges();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('#role-listbox')).toBeNull();
  });

  it('keeps the trigger disabled and does not open the panel', async () => {
    const fixture = await renderSelectMenu();
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector<HTMLButtonElement>('#role-trigger');

    if (!trigger) {
      throw new Error('Select menu trigger not rendered');
    }

    trigger.click();
    fixture.detectChanges();

    expect(trigger.disabled).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('#role-listbox')).toBeNull();
  });
});
