/**
 * Catálogo de hunts (F5-T1, spike S0.3): só entra o que tem fonte registrada em GAME_RULES.md.
 * Hoje são os níveis de hunt conhecidos por região (§3) e as 8 Outlands (§4). O nível de uma hunt
 * é o nível do treinador que ela exige (§2). Lacunas ficam explícitas em {@link CATALOG_GAPS}.
 *
 * TODO(game-data): nomes das hunts, espécies e tipos, níveis de Kanto e Hoenn e o restante das
 * listas parciais (OPEN_QUESTIONS.md #5).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { GAME_RULES_SOURCE_DATE, KNOWN_HUNT_LEVELS, OUTLANDS, REGIONS } from '@pokeidle-hub/shared';
import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Origem dos registros gerados a partir do GAME_RULES.md.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const CATALOG_SOURCE = `GAME_RULES.md (wiki ${GAME_RULES_SOURCE_DATE})`;

/**
 * Hunt do catálogo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface CatalogHunt {
  region: string;
  /** Nível do treinador exigido. */
  level: number;
  /** Nome exibido; só as Outlands têm nome conhecido ("Outland N"). */
  name: string | null;
  /** Índice da Outland (1–8), quando for uma. */
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
 * Hunts com fonte registrada.
 *
 * @returns Lista em ordem de região e nível.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function buildCatalog(): CatalogHunt[] {
  const hunts: CatalogHunt[] = [];
  for (const region of REGIONS) {
    if (region.name === 'Outland') {
      for (const outland of OUTLANDS) {
        hunts.push({
          region: 'Outland',
          level: outland.minTrainerLevel,
          name: `Outland ${outland.index}`,
          outland: outland.index,
          source: `${CATALOG_SOURCE} §4`,
        });
      }
      continue;
    }
    for (const level of KNOWN_HUNT_LEVELS[region.name] ?? []) {
      hunts.push({
        region: region.name,
        level,
        name: null,
        outland: null,
        source: `${CATALOG_SOURCE} §3`,
      });
    }
  }
  return hunts;
}

/**
 * Lacunas: regiões sem níveis listados e a ausência de nomes e espécies.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const CATALOG_GAPS: readonly CatalogGap[] = [
  ...REGIONS.filter((r) => r.name !== 'Outland' && !KNOWN_HUNT_LEVELS[r.name]).map((r) => ({
    region: r.name,
    reason: 'Níveis de hunt não listados na wiki',
  })),
  ...REGIONS.filter((r) => KNOWN_HUNT_LEVELS[r.name] && r.name !== 'Johto').map((r) => ({
    region: r.name,
    reason: 'Lista de níveis parcial na wiki',
  })),
  { region: 'Todas', reason: 'Nomes, espécies e tipos das hunts não constam na wiki' },
];

/**
 * Regrava o catálogo derivado do GAME_RULES.md (idempotente: substitui só os registros desta fonte).
 *
 * @param prisma Cliente Prisma.
 * @returns Quantidade de hunts gravadas.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export async function seedCatalog(prisma: PrismaClient): Promise<number> {
  const hunts = buildCatalog();
  await prisma.$transaction([
    prisma.huntCatalog.deleteMany({ where: { source: { startsWith: CATALOG_SOURCE } } }),
    prisma.huntCatalog.createMany({
      data: hunts.map((h) => ({
        region: h.region,
        level: h.level,
        species: null,
        types: [],
        source: h.source,
      })),
    }),
  ]);
  return hunts.length;
}
