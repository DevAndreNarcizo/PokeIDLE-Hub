import type { AlertView } from '@pokeidle-hub/shared';
import { alertText } from './alert-text';

const alert = (kind: AlertView['kind'], payload: Record<string, unknown> = {}): AlertView => ({
  id: '1',
  accountId: 1,
  kind,
  openedAt: '2026-11-09T12:00:00Z',
  resolvedAt: null,
  ackedAt: null,
  payload,
});

describe('alertText', () => {
  it('textos em pt-BR', () => {
    expect(alertText(alert('session_conflict'))).toBe('Conta aberta em outro lugar');
    expect(alertText(alert('daily_pending', { tasks: ['battle_pass', 'topidle_vote'] }))).toBe(
      'Pendente hoje: Passe de Batalha e voto TopIdle',
    );
    expect(alertText(alert('boost_expiring', { boosts: [{ kind: 'XP Boost' }] }))).toContain(
      'XP Boost',
    );
    expect(alertText(alert('stale_data', { receivedAt: '2026-11-09T21:56:00Z' }))).toBe(
      'Sem dados novos desde 18:56',
    );
  });
});
