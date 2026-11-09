/**
 * Leitura e gravação do estado das contas em PostgreSQL: snapshot atual (`account_state`),
 * histórico (`snapshots`) e visão consolidada para o painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountId, AccountSnapshot, AccountView } from '@pokeidle-hub/shared';
import { accountIdSchema, accountSnapshotSchema, isStale } from '@pokeidle-hub/shared';
import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Repositório das contas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class AccountRepository {
  /**
   * @param prisma Cliente Prisma.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Grava o snapshot se for mais novo que o atual, numa única instrução atômica: atualiza
   * `account_state` só quando `captured_at` avança e, nesse caso, acrescenta ao histórico.
   * Concorrência: o `ON CONFLICT ... WHERE` serializa escritas da mesma conta na linha.
   *
   * @param snapshot Snapshot validado.
   * @param receivedAt Instante do recebimento.
   * @returns `true` se gravou; `false` se era duplicado ou mais antigo.
   */
  async saveIfNewer(snapshot: AccountSnapshot, receivedAt: Date): Promise<boolean> {
    const payload = JSON.stringify(snapshot);
    const capturedAt = new Date(snapshot.capturedAt);
    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>`
      WITH up AS (
        INSERT INTO account_state (account_id, payload, captured_at, received_at)
        VALUES (${snapshot.accountId}, ${payload}::jsonb, ${capturedAt}, ${receivedAt})
        ON CONFLICT (account_id) DO UPDATE
          SET payload = EXCLUDED.payload,
              captured_at = EXCLUDED.captured_at,
              received_at = EXCLUDED.received_at
          WHERE account_state.captured_at < EXCLUDED.captured_at
        RETURNING account_id
      )
      INSERT INTO snapshots (account_id, captured_at, status, xp_trainer_per_hour, xp_pokemon_per_hour, payload)
      SELECT ${snapshot.accountId}, ${capturedAt}, ${snapshot.status},
             ${snapshot.session?.xpTrainerPerHour ?? null}::numeric,
             ${snapshot.session?.xpPokemonPerHour ?? null}::numeric,
             ${payload}::jsonb
      FROM up
      RETURNING id`;
    return rows.length === 1;
  }

  /**
   * Visão consolidada de todas as contas, em ordem de id.
   *
   * @param now Instante para calcular `stale`.
   * @returns Uma visão por conta cadastrada.
   */
  async listViews(now: Date): Promise<AccountView[]> {
    const accounts = await this.prisma.account.findMany({
      orderBy: { id: 'asc' },
      include: { state: true },
    });
    return accounts.map((account) => {
      const receivedAt = account.state?.receivedAt ?? null;
      const snapshot = account.state
        ? accountSnapshotSchema.safeParse(account.state.payload)
        : null;
      return {
        accountId: accountIdSchema.parse(account.id),
        label: account.label,
        nick: account.nick,
        // Payload gravado sempre passou pelo schema; se o contrato mudar, o antigo vira "sem dado".
        snapshot: snapshot?.success ? snapshot.data : null,
        receivedAt: receivedAt?.toISOString() ?? null,
        stale: isStale(receivedAt, now),
      };
    });
  }

  /**
   * Visão de uma conta.
   *
   * @param accountId Conta.
   * @param now Instante para calcular `stale`.
   * @returns Visão, ou `null` se a conta não existe.
   */
  async getView(accountId: AccountId, now: Date): Promise<AccountView | null> {
    return (await this.listViews(now)).find((view) => view.accountId === accountId) ?? null;
  }
}
