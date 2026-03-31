import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
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

  readonly options = input.required<readonly SelectMenuOption[]>();
  readonly value = input.required<string>();
  readonly valueChange = output<string>();
  readonly triggerId = input.required<string>();
  readonly listboxId = input.required<string>();

  protected readonly open = signal(false);

  protected readonly currentLabel = computed(() => {
    const v = this.value();
    return this.options().find((o) => o.value === v)?.label ?? '';
  });

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
