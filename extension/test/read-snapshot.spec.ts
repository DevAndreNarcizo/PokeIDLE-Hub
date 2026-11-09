import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountSnapshotSchema } from '@pokeidle-hub/shared';
import { detectStatus, offlineSnapshot, readSnapshot } from '../src/reader/read-snapshot.js';

const NOW = new Date('2026-11-09T12:00:00Z');

function load(name: string): Document {
  const html = readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('leitor de tela (fixtures ILUSTRATIVAS)', () => {
  it('detecta a tela "Conta aberta em outro lugar" como conflict', () => {
    expect(detectStatus(load('conflict.illustrative.html'))).toBe('conflict');
  });

  it('sem sinal documentado devolve unknown e não inventa nenhum campo', () => {
    const snap = readSnapshot(load('generic.illustrative.html'), 2, NOW);
    expect(snap).toEqual({
      accountId: 2,
      capturedAt: '2026-11-09T12:00:00.000Z',
      source: 'extension',
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
      reader: 'dom',
    });
  });

  it('contrato: tudo que o leitor produz passa no schema compartilhado', () => {
    for (const snap of [
      readSnapshot(load('conflict.illustrative.html'), 1, NOW),
      readSnapshot(load('generic.illustrative.html'), 4, NOW),
      offlineSnapshot(3, NOW),
    ]) {
      expect(accountSnapshotSchema.safeParse(snap).success).toBe(true);
    }
  });

  it('snapshot sem aba é offline', () => {
    expect(offlineSnapshot(3, NOW).status).toBe('offline');
  });
});
