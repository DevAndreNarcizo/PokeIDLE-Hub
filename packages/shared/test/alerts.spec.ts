import { describe, expect, it } from 'vitest';
import type { AccountSnapshot } from '../src/index.js';
import { deriveAlerts } from '../src/index.js';
import { buildIllustrativeSnapshot } from './fixtures/account-snapshot.fixture.js';

const NOW = new Date('2026-11-09T18:00:00Z');
const fresh = '2026-11-09T17:59:40Z';
const kinds = (
  snapshot: AccountSnapshot | null,
  receivedAt: string | null = fresh,
  daily: string[] = [],
) => deriveAlerts({ snapshot, receivedAt, dailyPending: daily }, NOW).map((a) => a.kind);

describe('deriveAlerts', () => {
  it('estado normal não gera alerta', () => {
    expect(kinds(buildIllustrativeSnapshot())).toEqual([]);
  });

  it('conta que nunca enviou dados não gera alerta (sem ponte configurada)', () => {
    expect(kinds(null, null)).toEqual([]);
  });

  it('session_conflict sozinho quando a conta está aberta em outro lugar', () => {
    const snap = {
      ...buildIllustrativeSnapshot(),
      status: 'conflict' as const,
      team: [{ species: 'X', level: 1, hpPct: 0 }],
    };
    expect(kinds(snap)).toEqual(['session_conflict']);
  });

  it('team_down com todos os HP em 0', () => {
    const snap = {
      ...buildIllustrativeSnapshot(),
      status: 'center' as const,
      team: [{ species: 'X', level: 1, hpPct: 0 }],
    };
    expect(kinds(snap)).toContain('team_down');
  });

  it('no_potions_or_revives por automação pausada ou mochila vazia', () => {
    const base = buildIllustrativeSnapshot();
    const paused: AccountSnapshot = {
      ...base,
      automations: { revive: 'on', potions: 'on', throwNonstop: 'on', returnToHunt: 'paused' },
    };
    const empty: AccountSnapshot = {
      ...base,
      inventory: { bronzeBossToken: 0, balls: null, potions: 0, revives: 0 },
    };
    expect(kinds(paused)).toEqual(['no_potions_or_revives']);
    expect(kinds(empty)).toEqual(['no_potions_or_revives']);
  });

  it('boost_expiring só com menos de 30 min restantes', () => {
    const base = buildIllustrativeSnapshot();
    const at = (iso: string) => ({ ...base, boosts: [{ kind: 'xp', expiresAt: iso, note: null }] });
    expect(kinds(at('2026-11-09T18:29:00Z'))).toEqual(['boost_expiring']);
    expect(kinds(at('2026-11-09T18:31:00Z'))).toEqual([]);
    expect(kinds(at('2026-11-09T17:59:00Z'))).toEqual([]);
  });

  it('stale_data após 2 × intervalo, suprimindo alertas do snapshot antigo', () => {
    const snap = { ...buildIllustrativeSnapshot(), status: 'conflict' as const };
    expect(kinds(snap, '2026-11-09T17:58:59Z')).toEqual(['stale_data']);
  });

  it('daily_pending vem da lista de pendências e vale até com dado obsoleto', () => {
    expect(kinds(null, '2026-11-09T10:00:00Z', ['battle_pass'])).toEqual(['daily_pending']);
  });
});
