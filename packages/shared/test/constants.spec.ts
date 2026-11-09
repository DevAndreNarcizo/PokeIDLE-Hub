import { describe, expect, it } from 'vitest';
import {
  GAME_RULES_SOURCE_DATE,
  KNOWN_HUNT_LEVELS,
  OUTLAND_RARE_BASE_CHANCE,
  OUTLANDS,
  REGIONS,
} from '../src/index.js';

describe('constantes do jogo (GAME_RULES.md)', () => {
  it('registra a data da wiki usada', () => {
    expect(GAME_RULES_SOURCE_DATE).toBe('2026-11-09');
  });

  it('tem 10 regiões em ordem crescente de nível mínimo', () => {
    expect(REGIONS).toHaveLength(10);
    const levels = REGIONS.map((r) => r.minTrainerLevel);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it('reproduz a chance do Bronze Boss Token por Outland da tabela §4', () => {
    const expectedPct = [0.05, 0.0625, 0.075, 0.1, 0.15, 0.2, 0.3, 0.4];
    OUTLANDS.forEach((outland, i) => {
      const pct = OUTLAND_RARE_BASE_CHANCE.bronzeBossToken * outland.rareMultiplier * 100;
      expect(pct).toBeCloseTo(expectedPct[i] ?? Number.NaN, 10);
    });
  });

  it('não lista níveis de hunt para Kanto e Hoenn (desconhecidos na wiki)', () => {
    expect(KNOWN_HUNT_LEVELS['Kanto']).toBeUndefined();
    expect(KNOWN_HUNT_LEVELS['Hoenn']).toBeUndefined();
    expect(KNOWN_HUNT_LEVELS['Paldea']?.at(-1)).toBe(160_300);
  });
});
