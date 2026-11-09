/**
 * Gravação das medições por hunt (decisão do dono no spike S0.3): a cada snapshot "caçando", estende
 * o trecho contínuo atual ou abre outro. Um trecho termina quando muda a hunt ou o pokemon ativo,
 * quando há um intervalo maior que {@link MAX_GAP_MS} entre leituras ou quando um contador da
 * sessão diminui (nova sessão do jogo).
 *
 * Premissa a confirmar com a tela real (OPEN_QUESTIONS.md #12): os contadores de `session`
 * (abates, ouro, capturas) são cumulativos dentro da sessão do jogo.
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
    if (snapshot.status !== 'hunting' || !hunt || !session) {
      return;
    }
    const at = new Date(snapshot.capturedAt);
    const species = snapshot.activePokemon?.species ?? null;
    const latest = await this.prisma.huntObservation.findFirst({
      where: { accountId: snapshot.accountId },
      orderBy: { endedAt: 'desc' },
    });
    const continues =
      latest !== null &&
      latest.region === hunt.region &&
      latest.huntLevel === hunt.level &&
      latest.species === species &&
      at > latest.endedAt &&
      at.getTime() - latest.endedAt.getTime() <= MAX_GAP_MS &&
      notDecreased(latest.kills, session.kills) &&
      notDecreased(latest.captures, session.captures) &&
      notDecreased(latest.gold === null ? null : Number(latest.gold), session.gold);

    const reading = {
      endedAt: at,
      kills: session.kills,
      gold: session.gold,
      captures: session.captures,
      xpTrainerPerHour: session.xpTrainerPerHour,
      xpPokemonPerHour: session.xpPokemonPerHour,
    };
    if (continues) {
      await this.prisma.huntObservation.update({ where: { id: latest.id }, data: reading });
      return;
    }
    await this.prisma.huntObservation.create({
      data: {
        ...reading,
        accountId: snapshot.accountId,
        region: hunt.region,
        huntLevel: hunt.level,
        huntName: hunt.name,
        species,
        pokemonLevel: snapshot.activePokemon?.level ?? null,
        startedAt: at,
        killsStart: session.kills,
        goldStart: session.gold,
        capturesStart: session.captures,
        source: snapshot.source,
      },
    });
  }
}

function notDecreased(previous: number | null, current: number | null): boolean {
  return previous === null || current === null || current >= previous;
}
