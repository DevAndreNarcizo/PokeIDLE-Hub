/**
 * FIXTURE ILUSTRATIVA de snapshot para testes da API. Valores inventados, não são dado real
 * do jogo (DESIGN.md §7).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountId, AccountSnapshot } from '@pokeidle-hub/shared';

/** Snapshot válido mínimo da conta, com overrides opcionais. */
export function illustrativeSnapshot(
  accountId: AccountId,
  capturedAt: string,
  overrides: Partial<AccountSnapshot> = {},
): AccountSnapshot {
  return {
    accountId,
    capturedAt,
    source: 'extension',
    status: 'hunting',
    trainerLevel: 377,
    hunt: { region: 'Johto', level: 350, name: null },
    team: [{ species: 'Ilustrativo', level: 380, hpPct: 100 }],
    activePokemon: null,
    session: {
      xpTrainerPerHour: 2_100_000,
      xpPokemonPerHour: 1_900_000,
      kills: 10,
      captures: 1,
      gold: 1_000,
      shinySeen: 0,
      shinyCaught: 0,
      rareDrops: null,
    },
    inventory: null,
    boosts: [],
    automations: null,
    daily: null,
    seasonalTypeOfDay: null,
    ...overrides,
  };
}
