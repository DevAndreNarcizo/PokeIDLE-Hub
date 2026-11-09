import { describe, expect, it } from 'vitest';
import { rareDropsPerHour, shinyHoursPerEvent } from '../src/index.js';

describe('shinyHoursPerEvent (GAME_RULES §5)', () => {
  it('923 abates/h → ~26 h por shiny', () => {
    expect(shinyHoursPerEvent(923)).toBeCloseTo(26.0, 1);
  });

  it('Secret Lure dobra a chance e cada +15% multiplica', () => {
    expect(shinyHoursPerEvent(1000, { secretLure: true })).toBeCloseTo(12, 6);
    expect(shinyHoursPerEvent(1000, { plus15Count: 2 })).toBeCloseTo(24 / 1.3225, 6);
  });

  it('sem abates não há número', () => {
    expect(shinyHoursPerEvent(null)).toBeNull();
    expect(shinyHoursPerEvent(0)).toBeNull();
  });
});

describe('rareDropsPerHour (GAME_RULES §4)', () => {
  it('Bronze Boss Token na Outland 1: 0,05% por abate', () => {
    expect(rareDropsPerHour(1000, 1, 'bronzeBossToken')).toBeCloseTo(0.5, 10);
  });

  it('multiplicador da Outland e Loot Boost (×1,4) se multiplicam', () => {
    expect(rareDropsPerHour(1000, 8, 'bronzeBossToken')).toBeCloseTo(4, 10); // 0,40%
    expect(rareDropsPerHour(1000, 8, 'bronzeBossToken', true)).toBeCloseTo(5.6, 10);
  });

  it('fragmentos: 0,000500% por abate × multiplicador', () => {
    expect(rareDropsPerHour(1_000_000, 4, 'keyFragment')).toBeCloseTo(10, 6);
  });

  it('Outland inexistente ou sem abates → null', () => {
    expect(rareDropsPerHour(1000, 9, 'bronzeBossToken')).toBeNull();
    expect(rareDropsPerHour(null, 1, 'bronzeBossToken')).toBeNull();
  });
});
