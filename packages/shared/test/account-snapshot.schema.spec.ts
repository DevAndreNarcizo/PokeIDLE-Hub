import { describe, expect, it } from 'vitest';
import { accountSnapshotSchema, parseAccountSnapshot } from '../src/index.js';
import {
  buildIllustrativeSnapshot,
  buildMinimalSnapshot,
} from './fixtures/account-snapshot.fixture.js';

describe('accountSnapshotSchema — válidos', () => {
  it('aceita um snapshot completo', () => {
    const result = parseAccountSnapshot(buildIllustrativeSnapshot());
    expect(result.ok).toBe(true);
  });

  it('aceita um snapshot mínimo com campos desconhecidos em null', () => {
    const result = parseAccountSnapshot(buildMinimalSnapshot());
    expect(result).toEqual({ ok: true, snapshot: buildMinimalSnapshot() });
  });

  it('aceita equipe com exatamente 5 pokemon', () => {
    const snap = buildIllustrativeSnapshot();
    snap.team = Array.from({ length: 5 }, (_, i) => ({ species: `P${i}`, level: 10, hpPct: 0 }));
    expect(accountSnapshotSchema.safeParse(snap).success).toBe(true);
  });
});

describe('accountSnapshotSchema — inválidos', () => {
  const cases: [string, (s: Record<string, unknown>) => void, string][] = [
    ['conta fora de 1..4', (s) => (s['accountId'] = 5), 'accountId'],
    ['data sem fuso UTC', (s) => (s['capturedAt'] = '2026-11-09 18:00'), 'capturedAt'],
    ['status desconhecido', (s) => (s['status'] = 'sleeping'), 'status'],
    ['origem desconhecida', (s) => (s['source'] = 'scraper'), 'source'],
    ['nível do treinador zero', (s) => (s['trainerLevel'] = 0), 'trainerLevel'],
    ['nível fracionário', (s) => (s['trainerLevel'] = 1.5), 'trainerLevel'],
    [
      'equipe com 6 pokemon',
      (s) => (s['team'] = Array.from({ length: 6 }, () => ({ species: 'X', level: 1, hpPct: 50 }))),
      'team',
    ],
    [
      'HP acima de 100%',
      (s) => (s['team'] = [{ species: 'X', level: 1, hpPct: 101 }]),
      'team.0.hpPct',
    ],
    [
      'abates negativos',
      (s) => ((s['session'] as Record<string, unknown>)['kills'] = -1),
      'session.kills',
    ],
    [
      'dia do passe acima de 30',
      (s) => ((s['daily'] as Record<string, unknown>)['battlePassDay'] = 31),
      'daily.battlePassDay',
    ],
    [
      'potência fora de P1..P5',
      (s) => ((s['activePokemon'] as Record<string, unknown>)['power'] = 6),
      'activePokemon.power',
    ],
    [
      'automação com estado inválido',
      (s) => ((s['automations'] as Record<string, unknown>)['revive'] = 'auto'),
      'automations.revive',
    ],
    ['campo extra na raiz', (s) => (s['password'] = 'x'), '(raiz)'],
  ];

  it.each(cases)('rejeita %s', (_name, mutate, path) => {
    const snap = buildIllustrativeSnapshot() as unknown as Record<string, unknown>;
    mutate(snap);
    const result = parseAccountSnapshot(snap);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.startsWith(`${path}:`))).toBe(true);
    }
  });

  it('rejeita entrada que não é objeto', () => {
    expect(parseAccountSnapshot('snapshot').ok).toBe(false);
    expect(parseAccountSnapshot(null).ok).toBe(false);
  });

  it('rejeita campo obrigatório ausente', () => {
    const snap = buildMinimalSnapshot() as unknown as Record<string, unknown>;
    delete snap['status'];
    expect(parseAccountSnapshot(snap).ok).toBe(false);
  });
});
