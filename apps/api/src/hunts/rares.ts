/**
 * Raros por hora nas Outlands (F5-T5, GAME_RULES.md §4): Bronze Boss Token e os três fragmentos,
 * a partir dos abates/h medidos. O Loot Boost (×1,4) não é aplicado porque a extensão ainda não
 * identifica o boost na tela.
 * TODO(game-data): reconhecer o Loot Boost ativo no snapshot (OPEN_QUESTIONS.md #12).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { RaresPerHour } from '@pokeidle-hub/shared';
import { rareDropsPerHour } from '@pokeidle-hub/shared';

/**
 * Raros por hora numa Outland.
 *
 * @param killsPerHour Abates/h medidos (iguais em todas as Outlands: mesmo mapa e pokemon).
 * @param outland Índice da Outland (1–8).
 * @returns Taxas por tipo de raro.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function outlandRares(killsPerHour: number | null, outland: number): RaresPerHour {
  return {
    bronzeBossToken: rareDropsPerHour(killsPerHour, outland, 'bronzeBossToken'),
    keyFragment: rareDropsPerHour(killsPerHour, outland, 'keyFragment'),
    shinyStoneFragment: rareDropsPerHour(killsPerHour, outland, 'shinyStoneFragment'),
    bicycleFragment: rareDropsPerHour(killsPerHour, outland, 'bicycleFragment'),
  };
}
