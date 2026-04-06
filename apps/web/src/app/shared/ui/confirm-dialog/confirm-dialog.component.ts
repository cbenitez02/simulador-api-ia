import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';

import { InlineAlertComponent } from '../inline-alert/inline-alert.component';

let confirmTitleUid = 0;

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [InlineAlertComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly message = input('');
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly destructive = input(false);
  readonly loading = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly confirmed = output<void>();
  readonly dismissed = output<void>();

  protected readonly titleDomId = `app-confirm-title-${++confirmTitleUid}`;

  protected onDismiss(): void {
    if (this.loading()) return;
    this.dismissed.emit();
  }

  protected onConfirm(): void {
    if (this.loading()) return;
    this.confirmed.emit();
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open() || this.loading() || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.dismissed.emit();
  }
}
