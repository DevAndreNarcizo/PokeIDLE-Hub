/**
 * Fórmulas de shiny/h e raros/h (GAME_RULES.md §4 e §5), puras e sem estimativas próprias: a
 * entrada principal (abates/h) vem de medição real da sessão (decisão do dono no spike S0.3).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import {
  LOOT_BOOST_MULTIPLIER,
  OUTLAND_RARE_BASE_CHANCE,
  OUTLANDS,
  SHINY_RULES,
} from '../game-rules/constants.js';
import type { OutlandRare } from '../game-rules/constants.js';

/**
 * Bônus que alteram a chance de shiny.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface ShinyBonuses {
  /** Shiny Secret Lure ativo (×2). */
  secretLure?: boolean;
  /** Quantos bônus de +15% (Twitch, Kick, Safari) estão ativos; multiplicam entre si. */
  plus15Count?: number;
}

/**
 * Horas esperadas por shiny: `24000 / (tentativasPorHora × multiplicadores)`.
 *
 * Pressupõe 1 tentativa de captura por abate (automação de arremesso ligada), como em §5.
 *
 * @param killsPerHour Abates por hora medidos.
 * @param bonuses Bônus ativos.
 * @returns Horas por shiny, ou `null` sem abates.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function shinyHoursPerEvent(
  killsPerHour: number | null,
  bonuses: ShinyBonuses = {},
): number | null {
  if (killsPerHour === null || killsPerHour <= 0) {
    return null;
  }
  const multiplier =
    (bonuses.secretLure ? SHINY_RULES.secretLureMultiplier : 1) *
    SHINY_RULES.streamOrSafariBonusMultiplier ** (bonuses.plus15Count ?? 0);
  return SHINY_RULES.baseOddsDenominator / (killsPerHour * multiplier);
}

/**
 * Raros por hora numa Outland: `abatesPorHora × chanceBase × multiplicador(outland) × lootBoost?`.
 * O multiplicador da Outland vale depois do Loot Boost (§4).
 *
 * @param killsPerHour Abates por hora medidos.
 * @param outland Índice da Outland (1–8).
 * @param rare Tipo de raro.
 * @param lootBoost Loot Boost ativo (×1,4).
 * @returns Raros por hora, ou `null` sem abates ou Outland inexistente.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function rareDropsPerHour(
  killsPerHour: number | null,
  outland: number,
  rare: OutlandRare,
  lootBoost = false,
): number | null {
  const rule = OUTLANDS.find((o) => o.index === outland);
  if (!rule || killsPerHour === null || killsPerHour <= 0) {
    return null;
  }
  return (
    killsPerHour *
    OUTLAND_RARE_BASE_CHANCE[rare] *
    (lootBoost ? LOOT_BOOST_MULTIPLIER : 1) *
    rule.rareMultiplier
  );
}
