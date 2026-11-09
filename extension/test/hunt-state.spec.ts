import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountSnapshotSchema } from '@pokeidle-hub/shared';
import { pickHuntState, snapshotFieldsFromHunt } from '../src/hunt/hunt-state.js';
import { readSnapshot } from '../src/reader/read-snapshot.js';

const NOW = new Date('2026-11-09T22:00:00Z');

/**
 * FIXTURE ILUSTRATIVA: forma do estado conforme os campos lidos pela /hunt for PokeIdle 1.0.17
 * (eu.level, eu.pokemons, eu.activeId, eu.balls, eu.loja.boosts, eu.diaSazonal.tipo). Valores
 * inventados; trocar por uma amostra real quando o dono enviar.
 */
function estadoIlustrativo(): Record<string, unknown> {
  return {
    level: 390,
    activeId: 7,
    pokemons: [
      { id: 3, nome: 'Outro', level: 10 },
      {
        id: 7,
        nome: 'Poliwrath',
        level: 94,
        tipos: ['water', 'FIGHTING'],
        potencia: 1,
        quality: 1.764,
        ivs: { hp: 16, atk: 1, def: 28, spAtk: 1, spDef: 25, speed: 12 },
        stats: { hp: 197, atk: 144, def: 224, spAtk: 107, spDef: 207, speed: 152 },
      },
    ],
    balls: { '1': 21, '4': 3 },
    loja: { boosts: { xp: NOW.getTime() + 3_600_000, captura: NOW.getTime() - 1 } },
    diaSazonal: { tipo: 'fighting' },
    email: 'nao-deve-sair@exemplo.test',
    wallet: 'nao-deve-sair',
  };
}

/** Estado escolhido, falhando o teste se vier nulo. */
function picked(estado: unknown = estadoIlustrativo()) {
  const state = pickHuntState(estado);
  if (!state) throw new Error('estado ilustrativo inválido');
  return state;
}

const page = () =>
  new DOMParser().parseFromString('<html><body><main>jogo</main></body></html>', 'text/html');

describe('estado da /hunt for PokeIdle', () => {
  it('repassa só o subconjunto usado (nada de e-mail, carteira ou outros pokemon)', () => {
    const picked = pickHuntState(estadoIlustrativo());
    const json = JSON.stringify(picked);
    expect(json).not.toContain('nao-deve-sair');
    expect(json).not.toContain('Outro');
    expect(picked?.level).toBe(390);
  });

  it('mapeia nível, pokemon ativo, bolas, boosts ativos e tipagem do dia', () => {
    const fields = snapshotFieldsFromHunt(picked(), NOW);
    expect(fields.trainerLevel).toBe(390);
    expect(fields.activePokemon).toEqual({
      species: 'Poliwrath',
      level: 94,
      types: ['Water', 'Fighting'],
      power: 1,
      quality: 1.764,
      ivs: { hp: 16, atk: 1, def: 28, spAtk: 1, spDef: 25, spd: 12 },
      stats: { hp: 197, atk: 144, def: 224, spAtk: 107, spDef: 207, spd: 152 },
      shiny: null,
    });
    expect(fields.inventory).toEqual({
      bronzeBossToken: null,
      potions: null,
      revives: null,
      balls: { '1': 21, '4': 3 },
    });
    expect(fields.boosts).toEqual([
      { kind: 'XP Boost', expiresAt: '2026-11-09T23:00:00.000Z', note: null },
    ]);
    expect(fields.seasonalTypeOfDay).toBe('Fighting');
  });

  it('não inventa: pokemon incompleto fica de fora; campos sem fonte não aparecem', () => {
    const estado = estadoIlustrativo();
    const ativo = (estado['pokemons'] as Record<string, unknown>[])[1];
    if (ativo) ativo['stats'] = { hp: 1 };
    const fields = snapshotFieldsFromHunt(picked(estado), NOW);
    expect(fields.activePokemon).toBeUndefined();
    expect(fields).not.toHaveProperty('session');
    expect(fields).not.toHaveProperty('automations');
    expect(fields).not.toHaveProperty('daily');
    expect(pickHuntState('lixo')).toBeNull();
  });

  it('leitor: com estado recente usa a /hunt; velho ou ausente volta para a tela', () => {
    const state = picked();
    const fresh = readSnapshot(page(), 1, NOW, { state, receivedAt: NOW.getTime() - 10_000 });
    expect(fresh).toMatchObject({ reader: 'hunt_extension', trainerLevel: 390 });
    expect(accountSnapshotSchema.safeParse(fresh).success).toBe(true);

    const old = readSnapshot(page(), 1, NOW, { state, receivedAt: NOW.getTime() - 5 * 60_000 });
    expect(old).toMatchObject({ reader: 'dom', trainerLevel: null });
    expect(readSnapshot(page(), 1, NOW, null).reader).toBe('dom');
  });

  it('em conflito a tela manda: nenhum dado da /hunt é usado', () => {
    const html = readFileSync(
      join(import.meta.dirname, 'fixtures', 'conflict.illustrative.html'),
      'utf8',
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const snap = readSnapshot(doc, 1, NOW, {
      state: picked(),
      receivedAt: NOW.getTime(),
    });
    expect(snap).toMatchObject({ status: 'conflict', reader: 'dom', trainerLevel: null });
  });
});
