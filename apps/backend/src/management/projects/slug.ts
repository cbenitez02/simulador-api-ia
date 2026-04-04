const RESERVED_SLUGS = new Set(['api', 'health', 'favicon.ico', 'mock']);

function normalizeBaseSlug(input: string): string {
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'project';
}

export function buildBaseSlug(name: string): string {
  return normalizeBaseSlug(name);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

export function resolveNextAvailableSlug(baseSlug: string, existingSlugs: string[]): string {
  const taken = new Set(existingSlugs);

  let candidate = baseSlug;
  let suffix = 2;

  while (isReservedSlug(candidate) || taken.has(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}
