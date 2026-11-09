/**
 * Textos em pt-BR dos alertas (ARCHITECTURE.md §8), usados no painel e no Web Push.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AlertView } from '../protocol/alert-view.js';
import { toLocal } from './calendar.js';

/** Hora "HH:MM" de Brasília. */
function brasiliaClock(iso: string | undefined): string {
  if (!iso) return '—';
  const l = toLocal(new Date(iso));
  return `${String(l.hour).padStart(2, '0')}:${String(l.minute).padStart(2, '0')}`;
}

const TASKS: Record<string, string> = {
  battle_pass: 'Passe de Batalha',
  topidle_vote: 'voto TopIdle',
};

/**
 * Descrição curta do alerta.
 *
 * @param alert Alerta.
 * @returns Texto.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function alertText(alert: AlertView): string {
  const payload = alert.payload ?? {};
  switch (alert.kind) {
    case 'session_conflict':
      return 'Conta aberta em outro lugar';
    case 'team_down':
      return 'Time caiu';
    case 'no_potions_or_revives':
      return 'Sem poções ou revives: Voltar à hunt pausou';
    case 'boost_expiring': {
      const boosts = (payload['boosts'] as { kind: string }[] | undefined)
        ?.map((b) => b.kind)
        .join(', ');
      return `Boost acabando em menos de 30 min${boosts ? `: ${boosts}` : ''}`;
    }
    case 'daily_pending': {
      const tasks = (payload['tasks'] as string[] | undefined)
        ?.map((t) => TASKS[t] ?? t)
        .join(' e ');
      return `Pendente hoje: ${tasks ?? 'diário'}`;
    }
    case 'stale_data':
      return `Sem dados novos desde ${brasiliaClock(payload['receivedAt'] as string | undefined)}`;
  }
}
