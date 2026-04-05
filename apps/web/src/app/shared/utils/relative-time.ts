const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatRelativeTime(date: string | Date, now = new Date()): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  const diffMs = value.getTime() - now.getTime();

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (Math.abs(diffMs) < minute) return 'Just now';
  if (Math.abs(diffMs) < hour) return rtf.format(Math.round(diffMs / minute), 'minute');
  if (Math.abs(diffMs) < day) return rtf.format(Math.round(diffMs / hour), 'hour');
  return rtf.format(Math.round(diffMs / day), 'day');
}
