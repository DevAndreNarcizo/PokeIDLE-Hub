import type { HuntRow } from '@pokeidle-hub/shared';
import { regionChips, toRowView } from './hunts-model';

const row = (over: Partial<HuntRow> = {}): HuntRow => ({
  region: 'Johto',
  level: 350,
  name: null,
  outland: null,
  source: 'GAME_RULES.md',
  measured: null,
  xpPerHour: null,
  goldPerHour: null,
  killsPerHour: null,
  killTimeSeconds: null,
  riskPct: null,
  shinyHours: null,
  rares: null,
  ...over,
});

describe('linhas da tabela de hunts', () => {
  it('sem medição mostra "sem medição ainda" e nunca número', () => {
    const v = toRowView(row());
    expect(v).toMatchObject({
      title: 'Johto · hunt nv 350',
      xp: 'sem medição ainda',
      kills: 'sem medição ainda',
      killTime: '—',
      risk: '—',
    });
  });

  it('com medição formata em pt-BR e mostra a origem', () => {
    const v = toRowView(
      row({
        measured: {
          hours: 1.5,
          samples: 2,
          lastAt: '2026-11-09T12:00:00Z',
          species: 'Ilustrativo',
        },
        xpPerHour: 17_900_000,
        goldPerHour: 921_200,
        killsPerHour: 923.4,
        shinyHours: 26.0,
      }),
    );
    expect(v.xp).toMatch(/^17,9\s?mi$/);
    expect(v.gold).toMatch(/^921,2\s?mil$/);
    expect(v.kills).toBe('923');
    expect(v.shiny).toBe('1 a cada 26 h');
    expect(v.measured).toBe('medido em 1,5 h com Ilustrativo');
  });

  it('raros: taxa baixa vira "1 a cada N h"', () => {
    const v = toRowView(
      row({
        region: 'Outland',
        outland: 1,
        rares: {
          bronzeBossToken: 0.36,
          keyFragment: 0.0036,
          shinyStoneFragment: 0,
          bicycleFragment: null,
        },
      }),
    );
    expect(v.rares).toEqual({ token: '0,4', key: '1 a cada 278 h', stone: '0', bike: '—' });
  });

  it('Outland: shiny não rola', () => {
    expect(toRowView(row({ region: 'Outland', name: 'Outland 1', outland: 1 })).shiny).toBe(
      'não rola',
    );
  });

  it('chips de região com melhor XP/h só na aba XP/h', () => {
    const rows = [
      row({ xpPerHour: 1_000, measured: { hours: 1, samples: 1, lastAt: '', species: null } }),
      row({ region: 'Outland' }),
    ];
    const chips = regionChips(rows, 'xp').map((c) => [
      c.label,
      c.best?.replace(/\s/g, ' ') ?? null,
    ]);
    expect(chips).toEqual([
      ['Todas', '1 mil'],
      ['Johto', '1 mil'],
      ['Outland', null],
    ]);
    expect(regionChips(rows, 'gold').every((c) => c.best === null)).toBe(true);
  });
});
