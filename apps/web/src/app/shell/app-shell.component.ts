import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastViewportComponent } from '../shared/ui/toast/toast-viewport.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, ToastViewportComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {}
