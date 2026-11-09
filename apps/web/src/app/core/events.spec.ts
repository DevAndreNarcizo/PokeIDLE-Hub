import type { GameEvent } from '@pokeidle-hub/shared/domain';
import { toEventView } from './events';

const ev = (at: string, allDay = false): GameEvent => ({
  id: 'x',
  kind: 'raid_close',
  title: 'Raid Gigantamax',
  action: 'Inscrição fecha',
  at,
  allDay,
});

describe('toEventView', () => {
  const now = new Date('2026-11-09T15:00:00Z'); // segunda 12:00 em Brasília

  it('hoje e amanhã', () => {
    expect(toEventView(ev('2026-11-09T19:00:00Z'), now, true)).toMatchObject({
      label: 'Raid Gigantamax',
      detail: 'Inscrição fecha hoje, 16:00',
      urgent: true,
    });
    expect(toEventView(ev('2026-11-10T15:00:00Z'), now, false).detail).toBe(
      'Inscrição fecha · amanhã, 12:00',
    );
  });

  it('outros dias com dia da semana e data', () => {
    expect(toEventView(ev('2026-11-11T23:00:00Z'), now, false).detail).toMatch(
      /^Inscrição fecha · Qua 11\/11 · 20:00$/,
    );
  });

  it('prazo de dia inteiro', () => {
    expect(toEventView(ev('2026-11-13T03:00:00Z', true), now, false).detail).toBe(
      'Inscrição fecha até 13/11',
    );
  });
});
