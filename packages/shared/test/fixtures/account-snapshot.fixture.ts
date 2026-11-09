/**
 * FIXTURE ILUSTRATIVA para testes de contrato. Os valores são inventados para exercitar o schema
 * e **não** representam dados reais do jogo nem de nenhuma conta (DESIGN.md §7).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountSnapshot } from '../../src/index.js';

/**
 * Snapshot completo e válido, com todos os campos preenchidos.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function buildIllustrativeSnapshot(): AccountSnapshot {
  return {
    accountId: 1,
    capturedAt: '2026-11-09T18:00:00.000Z',
    source: 'extension',
    status: 'hunting',
    trainerLevel: 377,
    hunt: { region: 'Johto', level: 350, name: null },
    team: [
      { species: 'Ilustrativo A', level: 380, hpPct: 100 },
      { species: 'Ilustrativo B', level: 378, hpPct: 64.5 },
    ],
    activePokemon: {
      species: 'Ilustrativo A',
      level: 380,
      types: ['Fire', 'Flying'],
      power: 3,
      quality: 1.2,
      ivs: { hp: 10, atk: 20, def: 5, spAtk: 0, spDef: 7, spd: 31 },
      stats: { hp: 900, atk: 800, def: 700, spAtk: 600, spDef: 500, spd: 400 },
      shiny: false,
    },
    session: {
      xpTrainerPerHour: 2_100_000,
      xpPokemonPerHour: 1_900_000,
      kills: 923,
      captures: 6,
      gold: 120_000,
      shinySeen: 0,
      shinyCaught: 0,
      rareDrops: { bronzeBossToken: 1 },
    },
    inventory: { bronzeBossToken: 12, potions: 40, revives: 8, balls: { ultra: 200 } },
    boosts: [{ kind: 'xpBoostTrainer', expiresAt: '2026-11-09T22:12:00.000Z', note: null }],
    automations: { revive: 'on', potions: 'on', returnToHunt: 'on', throwNonstop: 'on' },
    daily: { battlePassDay: 12, battlePassClaimedToday: true, topIdleVotedToday: false },
    seasonalTypeOfDay: null,
  };
}

/**
 * Snapshot mínimo válido: só o que é obrigatório, o resto desconhecido (`null`/vazio).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function buildMinimalSnapshot(): AccountSnapshot {
  return {
    accountId: 4,
    capturedAt: '2026-11-09T18:00:00Z',
    source: 'manual',
    status: 'unknown',
    trainerLevel: null,
    hunt: null,
    team: [],
    activePokemon: null,
    session: null,
    inventory: null,
    boosts: [],
    automations: null,
    daily: null,
    seasonalTypeOfDay: null,
  };
}
