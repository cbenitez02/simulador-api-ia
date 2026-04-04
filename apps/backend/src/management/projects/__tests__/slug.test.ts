import { describe, expect, it } from 'vitest';
import { buildBaseSlug, resolveNextAvailableSlug } from '../slug.js';

describe('projects/slug', () => {
  it('normaliza nombres con espacios y mayúsculas', () => {
    expect(buildBaseSlug('Mi API v2')).toBe('mi-api-v2');
  });

  it('resuelve slug reservado con sufijo incremental', () => {
    expect(resolveNextAvailableSlug('api', [])).toBe('api-2');
  });

  it('resuelve colisiones existentes con siguiente sufijo disponible', () => {
    expect(resolveNextAvailableSlug('pagos', ['pagos', 'pagos-2'])).toBe('pagos-3');
  });
});
