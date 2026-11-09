/**
 * Gravação das medições por hunt (decisão do dono no spike S0.3): a cada snapshot "caçando", estende
 * o trecho contínuo atual ou abre outro. Um trecho termina quando muda a hunt ou o pokemon ativo,
 * quando há um intervalo maior que {@link MAX_GAP_MS} entre leituras ou quando um contador da
 * sessão diminui (nova sessão do jogo).
 *
 * Fontes dos contadores: `counters` (acumulados da conta, vindos do estado do jogo pela /hunt) ou,
 * na falta, os de `session` (cumulativos na sessão do jogo e zerados pelo botão Reset, confirmado
 * nas capturas do dono em 09/11/2026). Uma queda de contador abre um trecho novo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountSnapshot } from '@pokeidle-hub/shared';
import type { PrismaClient } from '../generated/prisma/client.js';

/** Intervalo máximo entre leituras do mesmo trecho (5 min ≈ 10 sincronizações perdidas). */
export const MAX_GAP_MS = 5 * 60_000;

/**
 * Registrador de medições.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class ObservationRecorder {
  /**
   * @param prisma Cliente Prisma.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Registra o snapshot, se a conta estiver caçando com dados de sessão.
   *
   * @param snapshot Snapshot aceito.
   */
  async record(snapshot: AccountSnapshot): Promise<void> {
    const { hunt, session } = snapshot;
    const counters = snapshot.counters ?? null;
    // Sem região conhecida não há como casar com o catálogo; sem contadores não há o que medir.
    if (snapshot.status !== 'hunting' || !hunt || hunt.region === null || (!session && !counters)) {
      return;
    }
    const region = hunt.region;
    // Contadores acumulados da conta têm preferência sobre os da sessão do jogo.
    const kills = counters?.kills ?? session?.kills ?? null;
    const captures = counters?.captures ?? session?.captures ?? null;
    const gold = session?.gold ?? null;
    const xpTrainer = counters?.xpTrainer ?? null;
    const at = new Date(snapshot.capturedAt);
    const species = snapshot.activePokemon?.species ?? null;
    const latest = await this.prisma.huntObservation.findFirst({
      where: { accountId: snapshot.accountId },
      orderBy: { endedAt: 'desc' },
    });
    const continues =
      latest !== null &&
      latest.region === region &&
      latest.huntLevel === hunt.level &&
      latest.species === species &&
      at > latest.endedAt &&
      at.getTime() - latest.endedAt.getTime() <= MAX_GAP_MS &&
      notDecreased(latest.kills, kills) &&
      notDecreased(latest.captures, captures) &&
      notDecreased(latest.gold === null ? null : Number(latest.gold), gold) &&
      notDecreased(latest.xpTrainer === null ? null : Number(latest.xpTrainer), xpTrainer);

    const reading = {
      endedAt: at,
      kills,
      gold,
      captures,
      xpTrainer,
      xpTrainerPerHour: session?.xpTrainerPerHour ?? null,
      xpPokemonPerHour: session?.xpPokemonPerHour ?? null,
    };
    if (continues) {
      await this.prisma.huntObservation.update({ where: { id: latest.id }, data: reading });
      return;
    }
    await this.prisma.huntObservation.create({
      data: {
        ...reading,
        accountId: snapshot.accountId,
        region,
        huntLevel: hunt.level,
        huntName: hunt.name,
        species,
        pokemonLevel: snapshot.activePokemon?.level ?? null,
        startedAt: at,
        killsStart: kills,
        goldStart: gold,
        capturesStart: captures,
        xpTrainerStart: xpTrainer,
        source: snapshot.source,
      },
    });
  }
}

function notDecreased(previous: number | null, current: number | null): boolean {
  return previous === null || current === null || current >= previous;
}
