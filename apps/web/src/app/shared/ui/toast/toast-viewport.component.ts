import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideAlertCircle, LucideAlertTriangle, LucideCircleCheck, LucideInfo, LucideX } from '@lucide/angular';

import type { ToastItem } from './toast.model';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-viewport',
  standalone: true,
  imports: [LucideCircleCheck, LucideInfo, LucideAlertTriangle, LucideAlertCircle, LucideX],
  templateUrl: './toast-viewport.component.html',
  styleUrl: './toast-viewport.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastViewportComponent {
  protected readonly toastService = inject(ToastService);

  protected dismiss(id: string): void {
    this.toastService.dismiss(id);
  }

  protected runAction(toast: ToastItem): void {
    toast.action?.onClick();
    this.toastService.dismiss(toast.id);
  }
}
