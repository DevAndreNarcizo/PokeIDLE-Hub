import type { AccountSnapshot, AccountView } from '@pokeidle-hub/shared';
import { bannersOf, huntLabel, metricsOf, statusOf, teamOf } from './account-model';

// FIXTURE ILUSTRATIVA: valores inventados (DESIGN.md §7).
function snapshot(over: Partial<AccountSnapshot> = {}): AccountSnapshot {
  return {
    accountId: 1,
    capturedAt: '2026-11-09T12:00:00Z',
    source: 'extension',
    status: 'hunting',
    trainerLevel: 377,
    hunt: { region: 'Johto', level: 350, name: null },
    team: [
      { species: 'A', level: 380, hpPct: 100 },
      { species: 'B', level: 380, hpPct: 20 },
    ],
    activePokemon: null,
    session: {
      xpTrainerPerHour: 2_100_000,
      xpPokemonPerHour: null,
      kills: 10,
      captures: 6,
      gold: null,
      shinySeen: 0,
      shinyCaught: 0,
      rareDrops: { bronzeBossToken: 1, keyFragment: 2 },
    },
    inventory: { bronzeBossToken: 12, potions: 5, revives: 1, balls: null },
    boosts: [],
    automations: { revive: 'on', potions: 'on', returnToHunt: 'on', throwNonstop: 'off' },
    daily: null,
    seasonalTypeOfDay: null,
    ...over,
  };
}

function view(snap: AccountSnapshot | null, stale = false): AccountView {
  return {
    accountId: 1,
    label: 'Conta 1',
    nick: null,
    snapshot: snap,
    receivedAt: snap ? '2026-11-09T12:00:00Z' : null,
    stale,
  };
}

describe('modelo do painel da conta', () => {
  it('status por estado e "Desatualizado" quando obsoleto ou sem dado', () => {
    expect(statusOf(view(snapshot()))).toMatchObject({ label: 'Caçando', tone: 'ok' });
    expect(statusOf(view(snapshot({ status: 'center' })))).toMatchObject({
      label: 'No Centro Pokemon',
      tone: 'info',
    });
    expect(statusOf(view(snapshot({ status: 'conflict' })))).toMatchObject({
      label: 'Aberta em outro lugar',
      tone: 'warn',
    });
    expect(statusOf(view(snapshot(), true)).label).toBe('Desatualizado');
    expect(statusOf(view(null)).label).toBe('Desatualizado');
  });

  it('conflito: banner com "Jogar aqui" e métricas "—"', () => {
    const v = view(snapshot({ status: 'conflict' }));
    expect(bannersOf(v)).toEqual([expect.objectContaining({ kind: 'conflict', action: 'focus' })]);
    expect(metricsOf(v).every((m) => m.value === '—')).toBe(true);
  });

  it('time caído e Voltar à hunt pausado', () => {
    const down = snapshot({
      status: 'center',
      team: [{ species: 'A', level: 1, hpPct: 0 }],
      automations: { revive: 'on', potions: 'on', returnToHunt: 'paused', throwNonstop: 'off' },
    });
    expect(bannersOf(view(down))[0]).toMatchObject({
      kind: 'team_down',
      text: expect.stringContaining('pausou'),
    });
    const noItems = snapshot({
      inventory: { bronzeBossToken: 0, potions: 0, revives: 0, balls: null },
    });
    expect(bannersOf(view(noItems))[0]?.kind).toBe('no_items');
  });

  it('obsoleto mostra a hora do último dado em Brasília', () => {
    expect(bannersOf(view(snapshot(), true))[0]?.text).toContain('09:00');
  });

  it('métricas: valores conhecidos formatados, desconhecidos "—"', () => {
    const values = Object.fromEntries(metricsOf(view(snapshot())).map((m) => [m.label, m.value]));
    expect(values['XP treinador/h']).toMatch(/^2,1\s?mi$/);
    expect(values['XP pokemon/h']).toBe('—');
    expect(values['Shiny visto / capt.']).toBe('0 / 0');
    expect(values['Raros na sessão']).toBe('3');
    expect(values['Boss Tokens']).toBe('12');
  });

  it('equipe: barras, cor por vida e "de pé"', () => {
    const team = teamOf(view(snapshot()));
    expect(team?.standing).toBe('2/2 de pé');
    expect(team?.slots.map((s) => s.tone)).toEqual(['ok', 'warn']);
    expect(teamOf(view(snapshot({ team: [] })))).toBeNull();
  });

  it('rótulo da hunt', () => {
    expect(huntLabel(snapshot())).toBe('Johto · hunt nv 350');
    expect(huntLabel(snapshot({ status: 'center' }))).toBe('Centro Pokemon');
    expect(huntLabel(null)).toBeNull();
  });
});
