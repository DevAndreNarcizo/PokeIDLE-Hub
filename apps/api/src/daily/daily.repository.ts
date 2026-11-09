/**
 * Diário por conta (`daily_tasks`, ARCHITECTURE.md §6): registra, por dia de Brasília, se o Passe
 * de Batalha e o voto TopIdle foram resgatados, a partir do que a extensão leu. A virada às 00:00
 * (GAME_RULES.md §11) é natural: um novo dia não tem linhas "feitas", então tudo volta a pendente.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountId, AccountSnapshot } from '@pokeidle-hub/shared';
import { accountIdSchema, localDay, toLocal } from '@pokeidle-hub/shared';
import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Tarefas diárias acompanhadas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const DAILY_TASKS = ['battle_pass', 'topidle_vote'] as const;

/**
 * Tarefa diária.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type DailyTask = (typeof DAILY_TASKS)[number];

/**
 * Pendência de uma conta no dia.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface DailyPending {
  accountId: AccountId;
  day: string;
  tasks: DailyTask[];
}

/**
 * Converte "HH:MM" em minutos desde 00:00.
 *
 * @param hhmm Horário.
 * @returns Minutos.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function parseClock(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Repositório do diário.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class DailyRepository {
  /**
   * @param prisma Cliente Prisma.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Registra o diário lido no snapshot (sem `daily`, ou em conflito, não registra nada).
   * Um "feito" nunca volta a "pendente" no mesmo dia.
   *
   * @param snapshot Snapshot aceito.
   */
  async recordFromSnapshot(snapshot: AccountSnapshot): Promise<void> {
    const daily = snapshot.daily;
    if (!daily || snapshot.status === 'conflict') {
      return;
    }
    const capturedAt = new Date(snapshot.capturedAt);
    const day = new Date(`${localDay(capturedAt)}T00:00:00Z`);
    const reads: [DailyTask, boolean | null][] = [
      ['battle_pass', daily.battlePassClaimedToday],
      ['topidle_vote', daily.topIdleVotedToday],
    ];
    for (const [task, done] of reads) {
      if (done === null) {
        continue;
      }
      await this.prisma.$executeRaw`
        INSERT INTO daily_tasks (account_id, day, task, done_at)
        VALUES (${snapshot.accountId}, ${day}::date, ${task}, ${done ? capturedAt : null})
        ON CONFLICT (account_id, day, task) DO UPDATE
          SET done_at = COALESCE(daily_tasks.done_at, EXCLUDED.done_at)`;
    }
  }

  /**
   * Pendências do dia corrente (Brasília) depois do horário do lembrete. Só entram contas cujo
   * diário já foi lido alguma vez (sem dado, não há lembrete — nada é presumido).
   *
   * @param now Agora.
   * @param reminderAt Horário do lembrete "HH:MM" (padrão do ARCHITECTURE.md §8: 18:00).
   * @returns Pendências por conta (vazio antes do horário).
   */
  async pendingAfterReminder(now: Date, reminderAt: string): Promise<DailyPending[]> {
    const local = toLocal(now);
    if (local.hour * 60 + local.minute < parseClock(reminderAt)) {
      return [];
    }
    const today = localDay(now);
    const rows = await this.prisma.$queryRaw<{ account_id: number; task: string; done: boolean }[]>`
      SELECT k.account_id, k.task, EXISTS (
        SELECT 1 FROM daily_tasks d
        WHERE d.account_id = k.account_id AND d.task = k.task
          AND d.day = ${today}::date AND d.done_at IS NOT NULL
      ) AS done
      FROM (SELECT DISTINCT account_id, task FROM daily_tasks) k
      ORDER BY k.account_id, k.task`;
    const byAccount = new Map<AccountId, DailyTask[]>();
    for (const row of rows) {
      if (row.done) continue;
      const id = accountIdSchema.parse(row.account_id);
      byAccount.set(id, [...(byAccount.get(id) ?? []), row.task as DailyTask]);
    }
    return [...byAccount].map(([accountId, tasks]) => ({ accountId, day: today, tasks }));
  }

  /**
   * Situação do diário de um dia para todas as contas (`done` | `pending`; ausente = desconhecido).
   *
   * @param day Dia local "YYYY-MM-DD".
   * @returns Mapa conta → tarefa → situação.
   */
  async dayStatus(
    day: string,
  ): Promise<Record<string, Partial<Record<DailyTask, 'done' | 'pending'>>>> {
    const rows = await this.prisma.dailyTask.findMany({
      where: { day: new Date(`${day}T00:00:00Z`) },
    });
    const result: Record<string, Partial<Record<DailyTask, 'done' | 'pending'>>> = {};
    for (const row of rows) {
      (result[String(row.accountId)] ??= {})[row.task as DailyTask] = row.doneAt
        ? 'done'
        : 'pending';
    }
    return result;
  }
}
