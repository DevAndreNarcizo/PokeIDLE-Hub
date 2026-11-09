/**
 * Contrato do snapshot de uma conta (ARCHITECTURE.md §4), validado com zod. É a fronteira entre
 * a extensão (fonte não confiável) e a API. Campos que a fonte não conseguiu ler vêm `null`:
 * nunca são preenchidos com estimativas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { z } from 'zod';

/** Limite de pokemon na equipe (até 5, ARCHITECTURE.md §4). */
const MAX_TEAM_SIZE = 5;

const nonNegativeInt = z.int().nonnegative();
const nonNegativeNumber = z.number().nonnegative();
const isoUtc = z.iso.datetime();

/**
 * Identificador das quatro contas do dono. O limite de 4 contas por pessoa vem dos Termos do jogo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const accountIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

/**
 * Estado de uma conta como o hub o enxerga.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const accountStatusSchema = z.enum(['hunting', 'center', 'conflict', 'offline', 'unknown']);

/**
 * Origem do snapshot.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const snapshotSourceSchema = z.enum(['extension', 'manual', 'api']);

/**
 * Estado de uma automação do jogo. `paused` = interruptor ligado, mas parado por falta de item.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const autoStateSchema = z.enum(['on', 'off', 'paused']);

const sixStatsSchema = z.strictObject({
  hp: nonNegativeInt,
  atk: nonNegativeInt,
  def: nonNegativeInt,
  spAtk: nonNegativeInt,
  spDef: nonNegativeInt,
  spd: nonNegativeInt,
});

/**
 * Snapshot completo de uma conta num instante (ARCHITECTURE.md §4).
 *
 * `session.gold` foi acrescentado em 09/11/2026 para medir ouro/h por hunt (decisão do dono no
 * spike S0.3).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const accountSnapshotSchema = z.strictObject({
  accountId: accountIdSchema,
  capturedAt: isoUtc,
  source: snapshotSourceSchema,
  status: accountStatusSchema,
  trainerLevel: z.int().positive().nullable(),
  hunt: z
    .strictObject({
      region: z.string().min(1).max(64),
      level: z.int().positive(),
      name: z.string().min(1).max(120).nullable(),
    })
    .nullable(),
  team: z
    .array(
      z.strictObject({
        species: z.string().min(1).max(64),
        level: z.int().positive(),
        hpPct: z.number().min(0).max(100),
      }),
    )
    .max(MAX_TEAM_SIZE),
  activePokemon: z
    .strictObject({
      species: z.string().min(1).max(64),
      level: z.int().positive(),
      types: z.array(z.string().min(1).max(32)).min(1).max(2),
      power: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
      quality: nonNegativeNumber,
      ivs: sixStatsSchema,
      stats: sixStatsSchema,
      /** `null` quando a fonte não informa (a tela e a /hunt não expõem com certeza). */
      shiny: z.boolean().nullable(),
    })
    .nullable(),
  session: z
    .strictObject({
      xpTrainerPerHour: nonNegativeNumber.nullable(),
      xpPokemonPerHour: nonNegativeNumber.nullable(),
      kills: nonNegativeInt.nullable(),
      captures: nonNegativeInt.nullable(),
      gold: nonNegativeNumber.nullable(),
      shinySeen: nonNegativeInt.nullable(),
      shinyCaught: nonNegativeInt.nullable(),
      rareDrops: z.record(z.string().min(1).max(64), nonNegativeInt).nullable(),
    })
    .nullable(),
  inventory: z
    .strictObject({
      bronzeBossToken: nonNegativeInt.nullable(),
      potions: nonNegativeInt.nullable(),
      revives: nonNegativeInt.nullable(),
      balls: z.record(z.string().min(1).max(32), nonNegativeInt).nullable(),
    })
    .nullable(),
  boosts: z
    .array(
      z.strictObject({
        kind: z.string().min(1).max(64),
        expiresAt: isoUtc.nullable(),
        note: z.string().max(200).nullable(),
      }),
    )
    .max(32),
  automations: z
    .strictObject({
      revive: autoStateSchema,
      potions: autoStateSchema,
      returnToHunt: autoStateSchema,
      throwNonstop: autoStateSchema,
    })
    .nullable(),
  daily: z
    .strictObject({
      battlePassDay: z.int().min(1).max(30).nullable(),
      battlePassClaimedToday: z.boolean().nullable(),
      topIdleVotedToday: z.boolean().nullable(),
    })
    .nullable(),
  seasonalTypeOfDay: z.string().min(1).max(32).nullable(),
  /**
   * De onde a extensão leu os dados (acrescentado em 09/11/2026): `hunt_extension` = estado do jogo
   * entregue pela extensão "/hunt for PokeIdle"; `dom` = leitura da tela (reserva, mais limitada).
   */
  reader: z.enum(['hunt_extension', 'dom']).nullable().optional(),
});

/** Número da conta (1 a 4). */
export type AccountId = z.infer<typeof accountIdSchema>;
/** Estado da conta. */
export type AccountStatus = z.infer<typeof accountStatusSchema>;
/** Origem do snapshot. */
export type SnapshotSource = z.infer<typeof snapshotSourceSchema>;
/** Estado de automação. */
export type AutoState = z.infer<typeof autoStateSchema>;
/** Snapshot validado de uma conta. */
export type AccountSnapshot = z.infer<typeof accountSnapshotSchema>;

/**
 * Resultado da validação de uma entrada externa: snapshot tipado ou lista legível de problemas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type SnapshotParseResult =
  { ok: true; snapshot: AccountSnapshot } | { ok: false; issues: string[] };

/**
 * Valida uma entrada desconhecida contra o contrato do snapshot, sem lançar exceção.
 *
 * @param input Corpo recebido da ponte ou da entrada manual.
 * @returns Snapshot tipado ou a lista de problemas no formato `caminho: mensagem`.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function parseAccountSnapshot(input: unknown): SnapshotParseResult {
  const result = accountSnapshotSchema.safeParse(input);
  if (result.success) {
    return { ok: true, snapshot: result.data };
  }
  return {
    ok: false,
    issues: result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`,
    ),
  };
}
