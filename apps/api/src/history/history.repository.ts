/**
 * Consultas ao histórico de snapshots e retenção (ARCHITECTURE.md §6). As métricas aceitas são
 * uma lista fechada mapeada para expressões SQL fixas: nada vindo do cliente entra no SQL.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { AccountId } from '@pokeidle-hub/shared';

/**
 * Métricas disponíveis no histórico. As duas primeiras são colunas indexáveis; as demais vêm do
 * `payload` jsonb do snapshot.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const HISTORY_METRICS = {
  xpTrainerPerHour: Prisma.raw('xp_trainer_per_hour::float8'),
  xpPokemonPerHour: Prisma.raw('xp_pokemon_per_hour::float8'),
  kills: Prisma.raw("(payload->'session'->>'kills')::float8"),
  captures: Prisma.raw("(payload->'session'->>'captures')::float8"),
  gold: Prisma.raw("(payload->'session'->>'gold')::float8"),
  trainerLevel: Prisma.raw("(payload->>'trainerLevel')::float8"),
} as const;

/**
 * Nome de métrica do histórico.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type HistoryMetric = keyof typeof HISTORY_METRICS;

/**
 * Ponto da série temporal (`value` nulo quando a fonte não leu o dado naquele instante).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface HistoryPoint {
  capturedAt: string;
  status: string;
  value: number | null;
}

/**
 * Repositório do histórico.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class HistoryRepository {
  /**
   * @param prisma Cliente Prisma.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Série de uma métrica de uma conta no intervalo [from, to], em ordem cronológica.
   * Usa o índice `snapshots_account_time` (account_id, captured_at DESC).
   *
   * @param accountId Conta.
   * @param from Início (inclusive).
   * @param to Fim (inclusive).
   * @param metric Métrica.
   * @returns Pontos da série.
   */
  async series(
    accountId: AccountId,
    from: Date,
    to: Date,
    metric: HistoryMetric,
  ): Promise<HistoryPoint[]> {
    const rows = await this.prisma.$queryRaw<
      { captured_at: Date; status: string; value: number | null }[]
    >`
      SELECT captured_at, status, ${HISTORY_METRICS[metric]} AS value
      FROM snapshots
      WHERE account_id = ${accountId} AND captured_at BETWEEN ${from} AND ${to}
      ORDER BY captured_at ASC`;
    return rows.map((row) => ({
      capturedAt: row.captured_at.toISOString(),
      status: row.status,
      value: row.value,
    }));
  }

  /**
   * Apaga snapshots capturados antes do corte.
   *
   * @param cutoff Instante limite (exclusivo).
   * @returns Quantidade apagada.
   */
  async deleteOlderThan(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.snapshot.deleteMany({
      where: { capturedAt: { lt: cutoff } },
    });
    return count;
  }
}
