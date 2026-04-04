import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideSparkles } from '@lucide/angular';
import { InlineAlertComponent } from '../../../../shared/ui/inline-alert/inline-alert.component';
import { PendingButtonComponent } from '../../../../shared/ui/pending-button/pending-button.component';
import { SectionHeadingComponent } from '../../../../shared/ui/section-heading/section-heading.component';

@Component({
  selector: 'app-create-endpoint-prompt-step',
  standalone: true,
  templateUrl: './create-endpoint-prompt-step.component.html',
  styleUrls: ['./create-endpoint-prompt-step.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InlineAlertComponent, LucideSparkles, PendingButtonComponent, SectionHeadingComponent],
})
export class CreateEndpointPromptStepComponent {
  readonly promptText = input('');
  readonly generating = input(false);
  readonly promptError = input<string | null>(null);
  readonly generationError = input<string | null>(null);

  readonly promptTextChange = output<string>();
  readonly generate = output<void>();

  protected onInput(event: Event): void {
    this.promptTextChange.emit((event.target as HTMLTextAreaElement).value);
  }

  protected onGenerate(): void {
    this.generate.emit();
  }
}
