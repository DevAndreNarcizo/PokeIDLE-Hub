import { describe, expect, it } from 'vitest';
import { fromLocal, localDay, nextEvents, toLocal } from '../src/index.js';

const kinds = (now: string, limit = 20) =>
  nextEvents(new Date(now), limit).map((e) => `${e.kind}@${e.at}`);

describe('calendário recorrente (America/Sao_Paulo)', () => {
  it('converte entre local e UTC (Brasília é UTC−3, sem horário de verão)', () => {
    expect(fromLocal({ year: 2026, month: 11, day: 9, hour: 18, minute: 0 }).toISOString()).toBe(
      '2026-11-09T21:00:00.000Z',
    );
    expect(toLocal(new Date('2026-11-10T02:30:00Z'))).toMatchObject({
      day: 9,
      hour: 23,
      minute: 30,
      weekday: 1,
    });
    expect(localDay(new Date('2026-11-10T02:59:00Z'))).toBe('2026-11-09');
    expect(localDay(new Date('2026-11-10T03:00:00Z'))).toBe('2026-11-10');
  });

  it('segunda 09/11 15:00: o mais urgente é o fechamento do Raid às 16:00', () => {
    const [first, second] = nextEvents(new Date('2026-11-09T18:00:00Z'));
    expect(first).toMatchObject({ kind: 'raid_close', at: '2026-11-09T19:00:00.000Z' });
    expect(second).toMatchObject({ kind: 'seasonal_type', at: '2026-11-09T21:00:00.000Z' });
  });

  it('virada do dia: após 23:59 o próximo é 00:00 do dia seguinte', () => {
    const events = nextEvents(new Date('2026-11-10T02:59:30Z'), 1);
    expect(events[0]).toMatchObject({ kind: 'daily_reset', at: '2026-11-10T03:00:00.000Z' });
  });

  it('semana: Showdown na quarta, virada semanal no sábado 23:59', () => {
    const list = kinds('2026-11-09T12:00:00Z', 40);
    expect(list).toContain('showdown_lock@2026-11-11T23:00:00.000Z');
    expect(list).toContain('showdown_fights@2026-11-12T00:00:00.000Z');
    expect(list).toContain('weekly_reset@2026-11-15T02:59:00.000Z');
    expect(list).toContain('raid_open@2026-11-10T15:00:00.000Z');
  });

  it('mês: Amador 13/15, Mundial 28 e último dia (30/11), fechamento no dia 1', () => {
    const list = kinds('2026-11-12T12:00:00Z', 200);
    expect(list).toContain('amateur_signup@2026-11-13T03:00:00.000Z');
    expect(list).toContain('amateur_fights@2026-11-15T03:00:00.000Z');
    expect(list).toContain('world_signup@2026-11-28T03:00:00.000Z');
    expect(list).toContain('world_fights@2026-11-30T03:00:00.000Z');
    expect(list).toContain('monthly_close@2026-12-01T03:00:00.000Z');
  });

  it('virada de mês em fevereiro: Mundial no último dia (28 ou 29)', () => {
    expect(kinds('2027-02-20T12:00:00Z', 200)).toContain('world_fights@2027-02-28T03:00:00.000Z');
    expect(kinds('2028-02-20T12:00:00Z', 200)).toContain('world_fights@2028-02-29T03:00:00.000Z');
  });

  it('prazo de dia inteiro continua visível durante o próprio dia', () => {
    const events = nextEvents(new Date('2026-11-13T20:00:00Z'), 3);
    expect(events[0]).toMatchObject({ kind: 'amateur_signup', allDay: true });
  });

  it('horário de verão: funciona em fuso com DST (São Paulo em 2018 começou o DST em 04/11)', () => {
    // 00:00 de 04/11/2018 não existiu em São Paulo (pulou para 01:00 −02:00).
    const midnight = fromLocal(
      { year: 2018, month: 11, day: 4, hour: 0, minute: 0 },
      'America/Sao_Paulo',
    );
    expect(midnight.toISOString()).toBe('2018-11-04T03:00:00.000Z');
    expect(toLocal(midnight, 'America/Sao_Paulo').hour).toBe(1);
    // 18:00 no dia já em DST é UTC−2.
    expect(
      fromLocal(
        { year: 2018, month: 11, day: 4, hour: 18, minute: 0 },
        'America/Sao_Paulo',
      ).toISOString(),
    ).toBe('2018-11-04T20:00:00.000Z');
    // E o calendário continua gerando um evento por dia.
    const resets = nextEvents(new Date('2018-11-02T12:00:00Z'), 60, 'America/Sao_Paulo').filter(
      (e) => e.kind === 'daily_reset',
    );
    expect(resets.map((e) => e.id).slice(0, 13)).toEqual([
      'daily_reset:2018-11-03',
      'daily_reset:2018-11-04',
      'daily_reset:2018-11-05',
      'daily_reset:2018-11-06',
      'daily_reset:2018-11-07',
      'daily_reset:2018-11-08',
      'daily_reset:2018-11-09',
      'daily_reset:2018-11-10',
      'daily_reset:2018-11-11',
      'daily_reset:2018-11-12',
      'daily_reset:2018-11-13',
      'daily_reset:2018-11-14',
      'daily_reset:2018-11-15',
    ]);
  });

  it('não há data fixa: um ano depois o padrão se repete', () => {
    expect(nextEvents(new Date('2027-11-08T18:00:00Z'))[0]?.kind).toBe('raid_close');
  });
});
