import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  EventEmitter,
  Input,
  inject,
  Output,
  signal,
} from '@angular/core';
import { LucideCrown, LucideEye, LucidePencil } from '@lucide/angular';

/** Iconos admitidos en opciones con pictograma (p. ej. roles de workspace). */
export type SelectMenuIconKey = 'eye' | 'pencil' | 'crown';

export interface SelectMenuOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: SelectMenuIconKey;
}

@Component({
  selector: 'app-select-menu',
  standalone: true,
  imports: [LucideCrown, LucideEye, LucidePencil],
  templateUrl: './select-menu.component.html',
  styleUrls: ['./select-menu.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectMenuComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) options: readonly SelectMenuOption[] = [];
  @Input({ required: true }) value = '';
  @Input() disabled = false;
  @Output() readonly valueChange = new EventEmitter<string>();
  @Input({ required: true }) triggerId = '';
  @Input({ required: true }) listboxId = '';
  /** Si es true y la opción activa tiene `icon`, el trigger muestra solo icono + chevron (p. ej. roles). */
  @Input() iconOnlyTrigger = false;

  protected readonly open = signal(false);

  protected get currentLabel(): string {
    return this.options.find((option) => option.value === this.value)?.label ?? '';
  }

  protected get currentIcon(): SelectMenuIconKey | undefined {
    return this.options.find((option) => option.value === this.value)?.icon;
  }

  protected get triggerHidesLabel(): boolean {
    return this.iconOnlyTrigger && this.currentIcon !== undefined;
  }

  protected get triggerAccessibleName(): string | null {
    return this.triggerHidesLabel ? this.currentLabel.trim() || 'Option' : null;
  }

  protected toggle(): void {
    if (this.disabled) {
      this.open.set(false);
      return;
    }

    this.open.update((o) => !o);
  }

  protected pick(optionValue: string): void {
    if (this.disabled) {
      this.open.set(false);
      return;
    }

    this.valueChange.emit(optionValue);
    this.open.set(false);
  }

  @HostListener('document:pointerdown', ['$event'])
  protected closeIfOutside(event: PointerEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    if (this.open()) {
      this.open.set(false);
    }
  }
}
