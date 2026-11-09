/**
 * Taxas da sessão medidas pela própria extensão: o estado do jogo traz totais acumulados (XP do
 * treinador, XP do pokemon ativo, abates e capturas pela Pokédex), não taxas. Aqui as taxas saem da
 * diferença entre leituras reais dentro do mesmo trecho (mesma hunt e mesmo pokemon ativo). Nada é
 * estimado: com menos de {@link MIN_WINDOW_MS} de observação, as taxas ficam `null`.
 *
 * "Sessão" aqui = desde que a extensão começou a observar esta hunt com este pokemon.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountSnapshot } from '@pokeidle-hub/shared';
import type { HuntState } from './hunt-state.js';

/** Observação mínima para publicar uma taxa por hora. */
export const MIN_WINDOW_MS = 2 * 60_000;

interface Sample {
  at: number;
  xp: number | null;
  pokeXp: number | null;
  kills: number | null;
  captures: number | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const decreased = (a: number | null, b: number | null) => a !== null && b !== null && b < a;

/**
 * Acompanha um trecho de caça e calcula as taxas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class SessionTracker {
  private key: string | null = null;
  private start: Sample | null = null;
  private last: Sample | null = null;

  /**
   * Registra uma leitura do estado.
   *
   * @param state Estado repassado pela página.
   * @param at Instante da leitura (ms).
   */
  update(state: HuntState, at: number): void {
    const hunting = state.noCentro === false && state.huntSlug !== null;
    if (!hunting) {
      this.reset();
      return;
    }
    const key = `${state.huntSlug}|${String(state.active?.id ?? '')}`;
    const sample: Sample = {
      at,
      xp: state.xpTotal,
      pokeXp: num(state.active?.xp),
      kills: state.dexKills,
      captures: state.dexCaptures,
    };
    const restart =
      key !== this.key ||
      !this.start ||
      // Morte (perde XP) ou troca de evolução zera a comparação: começa um trecho novo.
      decreased(this.last?.xp ?? null, sample.xp) ||
      decreased(this.last?.pokeXp ?? null, sample.pokeXp) ||
      decreased(this.last?.kills ?? null, sample.kills);
    if (restart) {
      this.key = key;
      this.start = sample;
    }
    this.last = sample;
  }

  /** Esquece o trecho atual. */
  reset(): void {
    this.key = null;
    this.start = null;
    this.last = null;
  }

  /**
   * Métricas da sessão no formato do snapshot, ou `null` fora de hunt.
   *
   * @returns Sessão medida.
   */
  session(): AccountSnapshot['session'] {
    const { start, last } = this;
    if (!start || !last) return null;
    const ms = last.at - start.at;
    const perHour = (a: number | null, b: number | null) =>
      ms >= MIN_WINDOW_MS && a !== null && b !== null ? ((b - a) * 3_600_000) / ms : null;
    const delta = (a: number | null, b: number | null) =>
      a !== null && b !== null ? Math.max(0, b - a) : null;
    return {
      xpTrainerPerHour: perHour(start.xp, last.xp),
      xpPokemonPerHour: perHour(start.pokeXp, last.pokeXp),
      kills: delta(start.kills, last.kills),
      captures: delta(start.captures, last.captures),
      gold: null,
      shinySeen: null,
      shinyCaught: null,
      rareDrops: null,
    };
  }
}
