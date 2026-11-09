/**
 * Lista de hunts por conta (F5-T3): hunts do catálogo liberadas para o nível do treinador, com as
 * métricas **medidas** nas sessões reais da conta (S0.3) e as fórmulas da wiki para shiny/h.
 * Nada é estimado: sem medição, o valor é `null` e a tela mostra "sem medição ainda".
 * "Mata em" e risco continuam sem fonte (OPEN_QUESTIONS.md #4 e #14).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type {
  AccountId,
  HuntMetric,
  HuntRow,
  HuntsResponse,
  RaresPerHour,
} from '@pokeidle-hub/shared';
import { shinyHoursPerEvent } from '@pokeidle-hub/shared';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { AccountViewReader } from '../sync/sync.coordinator.js';
import { CATALOG_GAPS, buildCatalog } from './hunt-catalog.js';

/** Trecho mínimo para contar como medição (evita números de poucos segundos). */
export const MIN_MEASURE_MS = 10 * 60_000;
/** Janela de medições consideradas. */
export const MEASURE_WINDOW_DAYS = 30;

export type { HuntMetric, HuntRow, HuntsResponse, RaresPerHour };

interface ObservationRow {
  region: string;
  hunt_level: number;
  species: string | null;
  started_at: Date;
  ended_at: Date;
  kills_start: number | null;
  kills: number | null;
  gold_start: string | null;
  gold: string | null;
  xp_trainer_per_hour: string | null;
}

interface Aggregate {
  hours: number;
  samples: number;
  lastAt: Date;
  species: string | null;
  killHours: number;
  kills: number;
  goldHours: number;
  gold: number;
  xpHours: number;
  xpWeighted: number;
}

/**
 * Serviço da lista de hunts.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class HuntsService {
  private readonly catalog = buildCatalog();

  /**
   * @param prisma Cliente Prisma.
   * @param views Leitura do estado da conta.
   * @param rares Cálculo de raros/h por Outland (F5-T5); ausente = sem raros.
   */
  constructor(
    private readonly prisma: PrismaClient,
    private readonly views: AccountViewReader,
    private readonly rares?: (killsPerHour: number | null, outland: number) => RaresPerHour,
  ) {}

  /**
   * Hunts da conta.
   *
   * @param accountId Conta.
   * @param metric Aba ativa (ordenação).
   * @param region Filtro de região (opcional).
   * @param now Agora.
   * @returns Lista e estado.
   */
  async list(
    accountId: AccountId,
    metric: HuntMetric,
    region: string | null,
    now: Date,
  ): Promise<HuntsResponse> {
    const view = await this.views.getView(accountId, now);
    const snap = view?.snapshot ?? null;
    const base = {
      accountId,
      metric,
      gaps: CATALOG_GAPS,
      activePokemon: snap?.activePokemon ?? null,
    };
    if (snap?.status === 'conflict') {
      return { ...base, state: 'conflict', trainerLevel: snap.trainerLevel, hunts: [] };
    }
    const trainerLevel = snap?.trainerLevel ?? null;
    if (trainerLevel === null) {
      return { ...base, state: 'no_sheet', trainerLevel: null, hunts: [] };
    }

    const species = snap?.activePokemon?.species ?? null;
    const aggregates = await this.aggregate(accountId, species, now);
    // As 8 Outlands têm o mesmo mapa e os mesmos pokemon (§4): a medição de qualquer uma vale para todas.
    const outland = mergeAggregates(
      [...aggregates].filter(([key]) => key.startsWith('Outland|')).map(([, a]) => a),
    );

    const hunts = this.catalog
      .filter((h) => h.level <= trainerLevel && (!region || h.region === region))
      .map((hunt): HuntRow => {
        const agg =
          hunt.outland !== null
            ? outland
            : (aggregates.get(`${hunt.region}|${hunt.level}`) ?? null);
        const killsPerHour = agg && agg.killHours > 0 ? agg.kills / agg.killHours : null;
        return {
          ...hunt,
          measured: agg
            ? {
                hours: agg.hours,
                samples: agg.samples,
                lastAt: agg.lastAt.toISOString(),
                species: agg.species,
              }
            : null,
          xpPerHour: agg && agg.xpHours > 0 ? agg.xpWeighted / agg.xpHours : null,
          goldPerHour: agg && agg.goldHours > 0 ? agg.gold / agg.goldHours : null,
          killsPerHour,
          killTimeSeconds: null,
          riskPct: null,
          shinyHours: hunt.outland !== null ? null : shinyHoursPerEvent(killsPerHour),
          rares:
            hunt.outland !== null && this.rares ? this.rares(killsPerHour, hunt.outland) : null,
        };
      });

    return { ...base, state: 'ok', trainerLevel, hunts: sortHunts(hunts, metric) };
  }

  /** Agrega os trechos medidos por hunt (região|nível), só com o pokemon ativo quando conhecido. */
  private async aggregate(
    accountId: AccountId,
    species: string | null,
    now: Date,
  ): Promise<Map<string, Aggregate>> {
    const since = new Date(now.getTime() - MEASURE_WINDOW_DAYS * 86_400_000);
    const rows = await this.prisma.$queryRaw<ObservationRow[]>`
      SELECT region, hunt_level, species, started_at, ended_at, kills_start, kills,
             gold_start::text, gold::text, xp_trainer_per_hour::text
      FROM hunt_observations
      WHERE account_id = ${accountId} AND ended_at >= ${since}
        AND ended_at - started_at >= make_interval(secs => ${MIN_MEASURE_MS / 1000})
        AND (${species}::text IS NULL OR species = ${species})`;
    const result = new Map<string, Aggregate>();
    for (const row of rows) {
      const hours = (row.ended_at.getTime() - row.started_at.getTime()) / 3_600_000;
      const key = `${row.region}|${row.hunt_level}`;
      const agg = result.get(key) ?? emptyAggregate(row.species);
      agg.hours += hours;
      agg.samples += 1;
      if (row.ended_at > agg.lastAt) agg.lastAt = row.ended_at;
      if (row.kills !== null && row.kills_start !== null) {
        agg.kills += row.kills - row.kills_start;
        agg.killHours += hours;
      }
      if (row.gold !== null && row.gold_start !== null) {
        agg.gold += Number(row.gold) - Number(row.gold_start);
        agg.goldHours += hours;
      }
      if (row.xp_trainer_per_hour !== null) {
        agg.xpWeighted += Number(row.xp_trainer_per_hour) * hours;
        agg.xpHours += hours;
      }
      result.set(key, agg);
    }
    return result;
  }
}

function emptyAggregate(species: string | null): Aggregate {
  return {
    hours: 0,
    samples: 0,
    lastAt: new Date(0),
    species,
    killHours: 0,
    kills: 0,
    goldHours: 0,
    gold: 0,
    xpHours: 0,
    xpWeighted: 0,
  };
}

function mergeAggregates(list: Aggregate[]): Aggregate | null {
  if (list.length === 0) return null;
  return list.reduce((acc, a) => ({
    hours: acc.hours + a.hours,
    samples: acc.samples + a.samples,
    lastAt: a.lastAt > acc.lastAt ? a.lastAt : acc.lastAt,
    species: acc.species ?? a.species,
    killHours: acc.killHours + a.killHours,
    kills: acc.kills + a.kills,
    goldHours: acc.goldHours + a.goldHours,
    gold: acc.gold + a.gold,
    xpHours: acc.xpHours + a.xpHours,
    xpWeighted: acc.xpWeighted + a.xpWeighted,
  }));
}

/**
 * Ordena pela aba ativa (maior primeiro; sem medição por último; desempate por nível).
 * Sem posição nem destaque de "melhor" (DESIGN.md §5: sem ranking).
 *
 * @param hunts Linhas.
 * @param metric Aba.
 * @returns Nova lista ordenada.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function sortHunts(hunts: HuntRow[], metric: HuntMetric): HuntRow[] {
  const value = (h: HuntRow): number | null => {
    switch (metric) {
      case 'xp':
        return h.xpPerHour;
      case 'gold':
        return h.goldPerHour;
      case 'shiny':
        // Menos horas por shiny é melhor.
        return h.shinyHours === null ? null : -h.shinyHours;
      case 'rares':
        return h.rares?.bronzeBossToken ?? null;
    }
  };
  return [...hunts].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return b.level - a.level;
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va || b.level - a.level;
  });
}
