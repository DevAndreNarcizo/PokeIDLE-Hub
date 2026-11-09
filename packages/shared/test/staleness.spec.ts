import { describe, expect, it } from 'vitest';
import { STALE_AFTER_MS, isStale } from '../src/index.js';

describe('isStale', () => {
  const now = new Date('2026-11-09T12:00:00Z');

  it('nunca recebido é obsoleto', () => {
    expect(isStale(null, now)).toBe(true);
  });

  it('respeita o limite de 2 × 30 s', () => {
    expect(STALE_AFTER_MS).toBe(60_000);
    expect(isStale('2026-11-09T11:59:00Z', now)).toBe(false); // exatamente 60 s
    expect(isStale('2026-11-09T11:58:59.999Z', now)).toBe(true);
    expect(isStale(new Date('2026-11-09T11:59:30Z'), now)).toBe(false);
  });

  it('data inválida é obsoleta', () => {
    expect(isStale('não é data', now)).toBe(true);
  });
});
