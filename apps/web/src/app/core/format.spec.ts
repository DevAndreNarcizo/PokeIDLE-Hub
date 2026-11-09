import { formatClock, formatCompact, formatInt, formatRemaining } from './format';

describe('formatação pt-BR', () => {
  it('números compactos e inteiros', () => {
    expect(formatCompact(2_100_000)).toMatch(/^2,1\s?mi$/);
    expect(formatCompact(921_200)).toMatch(/^921,2\s?mil$/);
    expect(formatInt(5310)).toBe('5.310');
    expect(formatCompact(null)).toBe('—');
  });

  it('hora em America/Sao_Paulo', () => {
    expect(formatClock('2026-11-09T21:56:34Z')).toBe('18:56:34');
    expect(formatClock(null)).toBe('—');
  });

  it('tempo restante', () => {
    const now = new Date('2026-11-09T12:00:00Z');
    expect(formatRemaining('2026-11-09T16:12:00Z', now)).toBe('4 h 12');
    expect(formatRemaining('2026-11-09T12:35:00Z', now)).toBe('35 min');
    expect(formatRemaining('2026-11-27T12:00:00Z', now)).toBe('18 d');
    expect(formatRemaining('2026-11-09T11:00:00Z', now)).toBe('expirado');
  });
});
