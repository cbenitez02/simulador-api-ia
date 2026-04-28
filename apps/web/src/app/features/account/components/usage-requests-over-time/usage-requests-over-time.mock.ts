/** Punto diario mock; sustituir por API cuando exista. */
export interface UsageRequestsDailyPoint {
  readonly isoDate: string;
  readonly value: number;
}

/** Serie 30d alineada con la referencia visual (Mar 30 – Apr 26). */
export const USAGE_REQUESTS_SERIES_30D: readonly UsageRequestsDailyPoint[] = [
  { isoDate: '2026-03-30', value: 450 },
  { isoDate: '2026-03-31', value: 380 },
  { isoDate: '2026-04-01', value: 310 },
  { isoDate: '2026-04-02', value: 250 },
  { isoDate: '2026-04-03', value: 290 },
  { isoDate: '2026-04-04', value: 520 },
  { isoDate: '2026-04-05', value: 850 },
  { isoDate: '2026-04-06', value: 720 },
  { isoDate: '2026-04-07', value: 580 },
  { isoDate: '2026-04-08', value: 640 },
  { isoDate: '2026-04-09', value: 510 },
  { isoDate: '2026-04-10', value: 480 },
  { isoDate: '2026-04-11', value: 530 },
  { isoDate: '2026-04-12', value: 600 },
  { isoDate: '2026-04-13', value: 660 },
  { isoDate: '2026-04-14', value: 700 },
  { isoDate: '2026-04-15', value: 620 },
  { isoDate: '2026-04-16', value: 550 },
  { isoDate: '2026-04-17', value: 480 },
  { isoDate: '2026-04-18', value: 720 },
  { isoDate: '2026-04-19', value: 880 },
  { isoDate: '2026-04-20', value: 980 },
  { isoDate: '2026-04-21', value: 920 },
  { isoDate: '2026-04-22', value: 760 },
  { isoDate: '2026-04-23', value: 990 },
  { isoDate: '2026-04-24', value: 540 },
  { isoDate: '2026-04-25', value: 320 },
  { isoDate: '2026-04-26', value: 250 },
] as const;

/** Últimos 7 días de la misma ventana temporal. */
export const USAGE_REQUESTS_SERIES_7D: readonly UsageRequestsDailyPoint[] = USAGE_REQUESTS_SERIES_30D.slice(-7);
