import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideEye, LucideFileText, LucideGitBranch, LucideSlidersHorizontal } from '@lucide/angular';

export type IconTabGlyph = 'fileText' | 'gitBranch' | 'sliders' | 'eye';

export interface IconTabItem {
  readonly id: string;
  readonly label: string;
  readonly icon: IconTabGlyph;
  readonly badge?: string | number;
}

@Component({
  selector: 'app-icon-tab-strip',
  standalone: true,
  templateUrl: './icon-tab-strip.component.html',
  styleUrls: ['./icon-tab-strip.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideEye, LucideFileText, LucideGitBranch, LucideSlidersHorizontal],
})
export class IconTabStripComponent {
  readonly tabs = input.required<readonly IconTabItem[]>();
  readonly activeId = input.required<string>();
  readonly ariaLabel = input('Tabs');

  readonly tabChange = output<string>();

  protected select(id: string): void {
    this.tabChange.emit(id);
  }
}
