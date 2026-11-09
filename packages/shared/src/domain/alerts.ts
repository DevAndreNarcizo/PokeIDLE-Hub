/**
 * Regras de alerta (ARCHITECTURE.md §8) como função pura. Recebe o último estado da conta e devolve
 * os alertas que devem estar abertos agora; abrir/resolver no banco fica com a API.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountSnapshot } from '../snapshot/account-snapshot.schema.js';
import { SYNC_INTERVAL_MS, isStale } from './staleness.js';

/**
 * Tipos de alerta.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type AlertKind =
  | 'session_conflict'
  | 'team_down'
  | 'no_potions_or_revives'
  | 'boost_expiring'
  | 'daily_pending'
  | 'stale_data';

/**
 * Antecedência do aviso de boost (ARCHITECTURE.md §8: menos de 30 min).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const BOOST_WARNING_MS = 30 * 60_000;

/**
 * Entrada da avaliação de uma conta.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface AlertInput {
  snapshot: AccountSnapshot | null;
  /** Quando o último snapshot foi recebido (ISO); `null` = a conta nunca enviou dados. */
  receivedAt: string | null;
  /** Tarefas diárias pendentes depois do horário do lembrete (vazio antes dele). */
  dailyPending: readonly string[];
}

/**
 * Alerta derivado, com dados de apoio.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface DerivedAlert {
  kind: AlertKind;
  payload: Record<string, unknown>;
}

/**
 * Alertas que devem estar abertos para a conta em `now`.
 *
 * Com dado obsoleto, só `stale_data` (e o diário, que vem do histórico): o resto do snapshot pode
 * não valer mais. Em conflito, as métricas não contam (DESIGN.md §2), então só `session_conflict`.
 *
 * @param input Estado da conta.
 * @param now Agora.
 * @param syncIntervalMs Intervalo de sincronização (obsoleto = 2 × intervalo).
 * @returns Alertas, sem repetição de tipo.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function deriveAlerts(
  input: AlertInput,
  now: Date,
  syncIntervalMs = SYNC_INTERVAL_MS,
): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];
  if (input.dailyPending.length > 0) {
    alerts.push({ kind: 'daily_pending', payload: { tasks: [...input.dailyPending] } });
  }
  const snap = input.snapshot;
  if (input.receivedAt === null || !snap) {
    return alerts;
  }
  if (isStale(input.receivedAt, now, 2 * syncIntervalMs)) {
    alerts.push({ kind: 'stale_data', payload: { receivedAt: input.receivedAt } });
    return alerts;
  }
  if (snap.status === 'conflict') {
    alerts.push({ kind: 'session_conflict', payload: {} });
    return alerts;
  }
  if (snap.team.length > 0 && snap.team.every((p) => p.hpPct === 0)) {
    alerts.push({ kind: 'team_down', payload: { status: snap.status } });
  }
  const paused = snap.automations?.returnToHunt === 'paused';
  const empty = snap.inventory?.potions === 0 && snap.inventory.revives === 0;
  if (paused || empty) {
    alerts.push({
      kind: 'no_potions_or_revives',
      payload: { returnToHuntPaused: paused, emptyBag: empty },
    });
  }
  const nowMs = now.getTime();
  const expiring = snap.boosts.filter((b) => {
    if (!b.expiresAt) return false;
    const left = Date.parse(b.expiresAt) - nowMs;
    return left > 0 && left <= BOOST_WARNING_MS;
  });
  if (expiring.length > 0) {
    alerts.push({
      kind: 'boost_expiring',
      payload: { boosts: expiring.map((b) => ({ kind: b.kind, expiresAt: b.expiresAt })) },
    });
  }
  return alerts;
}
