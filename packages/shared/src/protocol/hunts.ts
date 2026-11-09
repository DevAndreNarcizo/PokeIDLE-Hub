/**
 * Contrato de `GET /hunts` (F5-T3), compartilhado entre API e painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountId, AccountSnapshot } from '../snapshot/account-snapshot.schema.js';

/**
 * Aba/métrica da tela de hunts.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type HuntMetric = 'xp' | 'gold' | 'shiny' | 'rares';

/**
 * Hunt do catálogo (só dados com fonte).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface CatalogHunt {
  region: string;
  /** Nível do treinador exigido. */
  level: number;
  /** Nome conhecido (hoje só "Outland N"). */
  name: string | null;
  outland: number | null;
  source: string;
}

/**
 * Lacuna conhecida do catálogo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface CatalogGap {
  region: string;
  reason: string;
}

/**
 * Medição agregada de uma hunt.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface Measurement {
  hours: number;
  samples: number;
  lastAt: string;
  species: string | null;
}

/**
 * Raros por hora numa Outland.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface RaresPerHour {
  bronzeBossToken: number | null;
  keyFragment: number | null;
  shinyStoneFragment: number | null;
  bicycleFragment: number | null;
}

/**
 * Linha da tabela de hunts.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface HuntRow extends CatalogHunt {
  measured: Measurement | null;
  xpPerHour: number | null;
  goldPerHour: number | null;
  killsPerHour: number | null;
  /** Sem fonte de cálculo (S0.3). */
  killTimeSeconds: null;
  /** Sem fonte de cálculo (S0.3). */
  riskPct: null;
  /** "1 a cada X h"; `null` na Outland ou sem medição. */
  shinyHours: number | null;
  /** Só Outlands. */
  rares: RaresPerHour | null;
}

/**
 * Resposta de `GET /hunts`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface HuntsResponse {
  accountId: AccountId;
  state: 'ok' | 'no_sheet' | 'conflict';
  trainerLevel: number | null;
  activePokemon: AccountSnapshot['activePokemon'];
  metric: HuntMetric;
  hunts: HuntRow[];
  gaps: readonly CatalogGap[];
}
