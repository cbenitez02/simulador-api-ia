import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { smoothLinePathThrough } from './usage-chart-smooth-path';
import {
  USAGE_REQUESTS_SERIES_30D,
  USAGE_REQUESTS_SERIES_7D,
  type UsageRequestsDailyPoint,
} from './usage-requests-over-time.mock';

export type UsageRequestsRangeId = '7d' | '30d';

const DATE_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** Ancho/alto del viewBox SVG: ratio ~3.1 para alinear con tarjetas anchas (~679/220) y evitar bandas vacías con `meet`. */
const CHART_VIEWBOX_W = 520;
const CHART_VIEWBOX_H = 168;

interface UsageChartLayout {
  readonly viewBox: string;
  readonly linePath: string;
  readonly plotL: number;
  readonly plotR: number;
  readonly plotT: number;
  readonly plotB: number;
  readonly yAxisTextX: number;
  readonly horizontalYs: readonly number[];
  readonly verticalXs: readonly number[];
  readonly yTickLabels: readonly { readonly v: number; readonly y: number }[];
  readonly xLabels: readonly { readonly x: number; readonly label: string }[];
}

@Component({
  selector: 'app-usage-requests-over-time',
  standalone: true,
  templateUrl: './usage-requests-over-time.component.html',
  styleUrls: ['./usage-requests-over-time.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageRequestsOverTimeComponent {
  protected readonly range = signal<UsageRequestsRangeId>('30d');

  protected readonly series = computed((): readonly UsageRequestsDailyPoint[] =>
    this.range() === '7d' ? USAGE_REQUESTS_SERIES_7D : USAGE_REQUESTS_SERIES_30D,
  );

  protected readonly ariaLabel = computed(() => {
    const r = this.range() === '7d' ? 'last 7 days' : 'last 30 days';
    return `Requests over time, ${r}, mock daily volume (0 to 1000 scale).`;
  });

  protected readonly chartLayout = computed((): UsageChartLayout => {
    const pts = this.series();
    const plotL = 56;
    const plotR = CHART_VIEWBOX_W - 12;
    const plotT = 20;
    const plotB = 118;
    const yAxisTextX = plotL - 6;
    const plotW = plotR - plotL;
    const plotH = plotB - plotT;
    const yMax = 1000;
    const yMin = 0;
    const n = pts.length;

    const xAt = (i: number): number => (n <= 1 ? plotL + plotW / 2 : plotL + (i / (n - 1)) * plotW);
    const yAt = (v: number): number => plotT + (1 - (v - yMin) / (yMax - yMin)) * plotH;

    const pixelPoints = pts.map((p, i) => ({ x: xAt(i), y: yAt(p.value) }));
    const linePath = smoothLinePathThrough(pixelPoints);

    const yTicks = [1000, 750, 500, 250, 0] as const;
    const horizontalYs = yTicks.map((v) => yAt(v));
    const yTickLabels = yTicks.map((v) => ({ v, y: yAt(v) }));

    const step = this.range() === '7d' ? 1 : 3;
    const xLabelIndices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (i % step === 0 || i === n - 1) {
        xLabelIndices.push(i);
      }
    }
    const verticalXs = xLabelIndices.map((i) => xAt(i));
    const xLabels: { x: number; label: string }[] = xLabelIndices.map((i) => {
      const iso = pts[i]?.isoDate ?? '';
      const d = new Date(`${iso}T12:00:00`);
      return { x: xAt(i), label: DATE_LABEL.format(d) };
    });

    return {
      viewBox: `0 0 ${CHART_VIEWBOX_W} ${CHART_VIEWBOX_H}`,
      linePath,
      plotL,
      plotR,
      plotT,
      plotB,
      yAxisTextX,
      horizontalYs,
      verticalXs,
      yTickLabels,
      xLabels,
    };
  });

  protected selectRange(id: UsageRequestsRangeId): void {
    this.range.set(id);
  }
}
