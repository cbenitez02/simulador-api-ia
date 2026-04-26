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

export interface SelectMenuOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'app-select-menu',
  standalone: true,
  templateUrl: './select-menu.component.html',
  styleUrls: ['./select-menu.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectMenuComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) options: readonly SelectMenuOption[] = [];
  @Input({ required: true }) value = '';
  @Output() readonly valueChange = new EventEmitter<string>();
  @Input({ required: true }) triggerId = '';
  @Input({ required: true }) listboxId = '';

  protected readonly open = signal(false);

  protected get currentLabel(): string {
    return this.options.find((option) => option.value === this.value)?.label ?? '';
  }

  protected toggle(): void {
    this.open.update((o) => !o);
  }

  protected pick(optionValue: string): void {
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
