/**
 * Ciclo de vida dos alertas (ARCHITECTURE.md §8): avalia cada conta com `deriveAlerts`, abre o que
 * passou a valer (um aberto por conta e tipo, garantido pelo índice parcial `alerts_one_open`) e
 * resolve o que deixou de valer. Publica `alert.opened` e `alert.resolved`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountId, AlertKind, AlertView } from '@pokeidle-hub/shared';
import { accountIdSchema, deriveAlerts } from '@pokeidle-hub/shared';
import type { DailyRepository } from '../daily/daily.repository.js';
import type { HubEvents } from '../events/hub-events.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { Logger } from '../logger.js';
import type { AccountViewReader } from '../sync/sync.coordinator.js';

const ACCOUNT_IDS: readonly AccountId[] = [1, 2, 3, 4];

interface AlertRow {
  id: bigint;
  account_id: number | null;
  kind: string;
  opened_at: Date;
  resolved_at: Date | null;
  acked_at: Date | null;
  payload: unknown;
}

/**
 * Converte uma linha da tabela `alerts` na visão do painel.
 *
 * @param row Linha.
 * @returns Visão.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function toAlertView(row: AlertRow): AlertView {
  return {
    id: String(row.id),
    accountId: row.account_id === null ? null : accountIdSchema.parse(row.account_id),
    kind: row.kind as AlertKind,
    openedAt: row.opened_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString() ?? null,
    ackedAt: row.acked_at?.toISOString() ?? null,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
  };
}

/**
 * Dependências do serviço de alertas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface AlertServiceDeps {
  prisma: PrismaClient;
  views: AccountViewReader;
  daily: Pick<DailyRepository, 'pendingAfterReminder'>;
  events: HubEvents;
  logger: Logger;
  reminderAt: string;
  syncIntervalMs?: number;
}

/**
 * Serviço de alertas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class AlertService {
  /** Avaliações em série por conta (evita corrida entre ingestão e o relógio). */
  private readonly queues = new Map<AccountId, Promise<void>>();

  /**
   * @param deps Dependências.
   */
  constructor(private readonly deps: AlertServiceDeps) {}

  /**
   * Avalia uma conta.
   *
   * @param accountId Conta.
   * @param now Agora.
   */
  evaluate(accountId: AccountId, now: Date): Promise<void> {
    const previous = this.queues.get(accountId) ?? Promise.resolve();
    const next = previous
      .then(() => this.evaluateNow(accountId, now))
      .catch((err: unknown) => {
        this.deps.logger.error({ err, accountId }, 'falha ao avaliar alertas');
      });
    this.queues.set(accountId, next);
    return next;
  }

  /**
   * Avalia as 4 contas (relógio periódico: boosts, diário e dado obsoleto mudam com o tempo).
   *
   * @param now Agora.
   */
  async evaluateAll(now: Date): Promise<void> {
    await Promise.all(ACCOUNT_IDS.map((id) => this.evaluate(id, now)));
  }

  /**
   * Alertas para o painel.
   *
   * @param scope `open` (padrão) ou `recent` (abertos e os resolvidos nas últimas 24 h).
   * @param now Agora.
   * @returns Lista do mais novo para o mais antigo.
   */
  async list(scope: 'open' | 'recent', now: Date): Promise<AlertView[]> {
    const since = new Date(now.getTime() - 86_400_000);
    const rows = await this.deps.prisma.$queryRaw<AlertRow[]>`
      SELECT id, account_id, kind, opened_at, resolved_at, acked_at, payload FROM alerts
      WHERE resolved_at IS NULL OR (${scope === 'recent'} AND resolved_at >= ${since})
      ORDER BY opened_at DESC
      LIMIT 200`;
    return rows.map(toAlertView);
  }

  /**
   * Marca um alerta como visto ("Ciente").
   *
   * @param id Id do alerta.
   * @param now Agora.
   * @returns Alerta atualizado ou `null` se não existe.
   */
  async ack(id: bigint, now: Date): Promise<AlertView | null> {
    const rows = await this.deps.prisma.$queryRaw<AlertRow[]>`
      UPDATE alerts SET acked_at = COALESCE(acked_at, ${now}) WHERE id = ${id}
      RETURNING id, account_id, kind, opened_at, resolved_at, acked_at, payload`;
    return rows[0] ? toAlertView(rows[0]) : null;
  }

  private async evaluateNow(accountId: AccountId, now: Date): Promise<void> {
    const view = await this.deps.views.getView(accountId, now);
    if (!view) {
      return;
    }
    const pending = await this.deps.daily.pendingAfterReminder(now, this.deps.reminderAt);
    const derived = deriveAlerts(
      {
        snapshot: view.snapshot,
        receivedAt: view.receivedAt,
        dailyPending: pending.find((p) => p.accountId === accountId)?.tasks ?? [],
      },
      now,
      this.deps.syncIntervalMs,
    );
    const wanted = new Set(derived.map((d) => d.kind));
    const prisma = this.deps.prisma;

    for (const alert of derived) {
      // ON CONFLICT com o predicado do índice parcial: no máximo um aberto por (conta, tipo).
      const opened = await prisma.$queryRaw<AlertRow[]>`
        INSERT INTO alerts (account_id, kind, opened_at, payload)
        VALUES (${accountId}, ${alert.kind}, ${now}, ${JSON.stringify(alert.payload)}::jsonb)
        ON CONFLICT (account_id, kind) WHERE resolved_at IS NULL DO NOTHING
        RETURNING id, account_id, kind, opened_at, resolved_at, acked_at, payload`;
      if (opened[0]) {
        this.deps.events.emit('alert.opened', toAlertView(opened[0]));
      }
    }

    const resolved = await prisma.$queryRaw<AlertRow[]>`
      UPDATE alerts SET resolved_at = ${now}
      WHERE account_id = ${accountId} AND resolved_at IS NULL
        AND NOT (kind = ANY(${[...wanted]}::text[]))
      RETURNING id, account_id, kind, opened_at, resolved_at, acked_at, payload`;
    for (const row of resolved) {
      this.deps.events.emit('alert.resolved', toAlertView(row));
    }
  }
}
