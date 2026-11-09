import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountSnapshotSchema } from '@pokeidle-hub/shared';
import type { HuntState } from '../src/hunt/hunt-state.js';
import {
  brasiliaDayIndex,
  pickHuntState,
  regionForLevel,
  snapshotFieldsFromHunt,
} from '../src/hunt/hunt-state.js';
import { MIN_WINDOW_MS, SessionTracker } from '../src/hunt/session-tracker.js';
import { readSnapshot } from '../src/reader/read-snapshot.js';

// Amostra REAL anonimizada (ver fixtures/README.md). `servidorAgora` = 09/11/2026 19:35 em Brasília.
const raw = (): Record<string, unknown> =>
  JSON.parse(
    readFileSync(join(import.meta.dirname, 'fixtures', 'estado.real-anon.json'), 'utf8'),
  ) as Record<string, unknown>;
const NOW = new Date(1794263747901);

function picked(estado: unknown = raw()): HuntState {
  const state = pickHuntState(estado);
  if (!state) throw new Error('amostra inválida');
  return state;
}

const page = () =>
  new DOMParser().parseFromString('<html><body><main>jogo</main></body></html>', 'text/html');

describe('estado real da /hunt for PokeIdle', () => {
  it('repassa só o subconjunto usado: nada de nick, logins, Pokédex ou outros pokemon', () => {
    const json = JSON.stringify(picked());
    for (const leak of ['Jogador', 'anonimo', 'Charizard', '"k":', 'nick', 'login']) {
      expect(json).not.toContain(leak);
    }
  });

  it('mapeia status, hunt, nível, pokemon ativo e equipe', () => {
    const f = snapshotFieldsFromHunt(picked(), NOW);
    expect(f.status).toBe('hunting');
    expect(f.hunt).toEqual({ region: 'Johto', level: 290, name: 'Larvitar' });
    expect(f.trainerLevel).toBe(391);
    expect(f.activePokemon).toEqual({
      species: 'Poliwrath',
      level: 99,
      types: ['Water', 'Fighting'],
      power: 1,
      quality: 1.764,
      ivs: { hp: 16, atk: 1, def: 28, spAtk: 1, spDef: 25, spd: 12 },
      stats: { hp: 207, atk: 151, def: 235, spAtk: 112, spDef: 218, spd: 160 },
      shiny: false,
    });
    expect(f.team).toHaveLength(1);
    expect(f.team?.[0]?.species).toBe('Poliwrath');
    expect(f.team?.[0]?.hpPct).toBeCloseTo((1605 / 2484) * 100, 6);
  });

  it('mochila, automações, diário e tipagem do dia', () => {
    const f = snapshotFieldsFromHunt(picked(), NOW);
    expect(f.inventory).toEqual({
      bronzeBossToken: null,
      potions: 6434,
      revives: 607,
      balls: { '1': 0, '2': 0, '3': 0, '4': 12776, '5': 7 },
    });
    expect(f.automations).toEqual({
      revive: 'off',
      potions: 'on',
      returnToHunt: 'on',
      throwNonstop: 'on',
    });
    expect(f.daily).toEqual({
      battlePassDay: 11,
      battlePassClaimedToday: true,
      topIdleVotedToday: null,
    });
    expect(f.seasonalTypeOfDay).toBe('Fighting');
  });

  it('boosts ativos com prazo; os vencidos e os zerados ficam de fora', () => {
    const kinds = snapshotFieldsFromHunt(picked(), NOW).boosts?.map((b) => b.kind);
    expect(kinds).toEqual([
      'VIP',
      'Boost da Guild',
      'Evento',
      'Twitch +15% XP',
      'Twitch +15% Capture Boost',
      'Twitch +15% Secret Lure',
    ]);
    const evento = snapshotFieldsFromHunt(picked(), NOW).boosts?.find((b) => b.kind === 'Evento');
    expect(evento).toMatchObject({
      note: '+90% XP',
      expiresAt: new Date(1794292321029).toISOString(),
    });
  });

  it('contadores acumulados (Pokédex e XP total)', () => {
    expect(snapshotFieldsFromHunt(picked(), NOW).counters).toEqual({
      kills: 700 + 4568 + 15809 + 58,
      captures: 2 + 17 + 141,
      xpTrainer: 982522637,
    });
  });

  it('no Centro: status center e sem hunt', () => {
    const estado = { ...raw(), noCentro: true };
    expect(snapshotFieldsFromHunt(picked(estado), NOW)).toMatchObject({
      status: 'center',
      hunt: null,
    });
  });

  it('Voltar à hunt pausa sem poção nem revive (GAME_RULES §9)', () => {
    const estado = { ...raw(), items: {} };
    expect(snapshotFieldsFromHunt(picked(estado), NOW).automations?.returnToHunt).toBe('paused');
  });

  it('passe resgatado ontem vira pendente na virada de Brasília', () => {
    const nextDay = new Date('2026-11-10T03:00:01Z'); // 00:00:01 em Brasília
    expect(brasiliaDayIndex(nextDay)).toBe(20767);
    expect(snapshotFieldsFromHunt(picked(), nextDay).daily?.battlePassClaimedToday).toBe(false);
  });

  it('região só pelo catálogo da wiki', () => {
    expect(regionForLevel(290)).toBe('Johto');
    expect(regionForLevel(150)).toBeNull();
  });

  it('snapshot completo passa no contrato compartilhado', () => {
    const snap = readSnapshot(page(), 1, NOW, { state: picked(), receivedAt: NOW.getTime() });
    expect(snap.reader).toBe('hunt_extension');
    const parsed = accountSnapshotSchema.safeParse(snap);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it('em conflito a tela manda: nenhum dado da /hunt é usado', () => {
    const html = readFileSync(
      join(import.meta.dirname, 'fixtures', 'conflict.illustrative.html'),
      'utf8',
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const snap = readSnapshot(doc, 1, NOW, { state: picked(), receivedAt: NOW.getTime() });
    expect(snap).toMatchObject({ status: 'conflict', reader: 'dom', trainerLevel: null });
  });

  it('estado velho ou ausente volta para a tela', () => {
    const old = readSnapshot(page(), 1, NOW, {
      state: picked(),
      receivedAt: NOW.getTime() - 5 * 60_000,
    });
    expect(old.reader).toBe('dom');
    expect(pickHuntState('lixo')).toBeNull();
  });
});

describe('taxas medidas da sessão', () => {
  /** Estado com os contadores avançados (valores derivados da amostra real). */
  function advanced(extra: { xp: number; pokeXp: number; kills: number }): HuntState {
    const s = picked();
    return {
      ...s,
      xpTotal: (s.xpTotal ?? 0) + extra.xp,
      dexKills: (s.dexKills ?? 0) + extra.kills,
      active: s.active ? { ...s.active, xp: Number(s.active.xp) + extra.pokeXp } : null,
    };
  }

  it('sem 2 min de observação não publica taxa; depois mede pela diferença', () => {
    const t = new SessionTracker();
    const t0 = NOW.getTime();
    t.update(picked(), t0);
    t.update(advanced({ xp: 100_000, pokeXp: 90_000, kills: 1 }), t0 + 60_000);
    expect(t.session()?.xpTrainerPerHour).toBeNull();
    t.update(advanced({ xp: 1_000_000, pokeXp: 900_000, kills: 9 }), t0 + 10 * 60_000);
    expect(t.session()).toMatchObject({
      xpTrainerPerHour: 6_000_000,
      xpPokemonPerHour: 5_400_000,
      kills: 9,
      captures: 0,
    });
  });

  it('trocar de hunt ou morrer (XP cai) recomeça o trecho; no Centro não há sessão', () => {
    const t = new SessionTracker();
    t.update(picked(), 0);
    t.update(advanced({ xp: 500, pokeXp: 0, kills: 5 }), MIN_WINDOW_MS + 1);
    t.update(
      { ...advanced({ xp: 500, pokeXp: 0, kills: 5 }), huntSlug: 'outra' },
      MIN_WINDOW_MS + 2,
    );
    expect(t.session()?.kills).toBe(0);
    t.update(advanced({ xp: -1_000_000, pokeXp: 0, kills: 6 }), MIN_WINDOW_MS + 3);
    expect(t.session()?.kills).toBe(0);
    t.update({ ...picked(), noCentro: true }, MIN_WINDOW_MS + 4);
    expect(t.session()).toBeNull();
  });
});
