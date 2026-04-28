export type UsageQuotaCardIcon = 'requests' | 'endpoints' | 'ai' | 'projects';

export type UsageQuotaBarFill = 'accent' | 'orange';

export interface UsageQuotaTrendSnapshot {
  readonly direction: 'up' | 'down';
  readonly pct: number;
}
