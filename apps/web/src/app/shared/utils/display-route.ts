/** Normalizes a route for display (leading slash, non-empty). */
export function displayRoute(raw: string): string {
  const t = raw.trim();
  if (!t) return '/';
  return t.startsWith('/') ? t : `/${t}`;
}
