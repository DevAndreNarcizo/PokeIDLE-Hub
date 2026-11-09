import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/db/client.js';
import { CATALOG_GAPS, buildCatalog, seedCatalog } from '../src/hunts/hunt-catalog.js';
import { TEST_DATABASE_URL, testPrisma } from './support/db.js';

describe('catálogo de hunts (só dados com fonte)', () => {
  const catalog = buildCatalog();

  it('tem os níveis conhecidos de GAME_RULES §3 e as 8 Outlands de §4', () => {
    expect(catalog.filter((h) => h.region === 'Johto').map((h) => h.level)).toEqual([
      200, 230, 260, 290, 320, 350, 380, 410, 440, 470,
    ]);
    expect(catalog.filter((h) => h.outland !== null).map((h) => [h.name, h.level])).toEqual([
      ['Outland 1', 150],
      ['Outland 2', 1_000],
      ['Outland 3', 2_000],
      ['Outland 4', 4_000],
      ['Outland 5', 8_000],
      ['Outland 6', 16_000],
      ['Outland 7', 24_000],
      ['Outland 8', 36_000],
    ]);
    expect(catalog.at(-1)).toMatchObject({ region: 'Paldea', level: 160_300 });
  });

  it('não inventa: sem nomes fora das Outlands, sem Kanto/Hoenn e com fonte em todos', () => {
    expect(catalog.filter((h) => h.outland === null).every((h) => h.name === null)).toBe(true);
    expect(catalog.some((h) => h.region === 'Kanto' || h.region === 'Hoenn')).toBe(false);
    expect(catalog.every((h) => h.source.startsWith('GAME_RULES.md'))).toBe(true);
  });

  it('marca as lacunas', () => {
    expect(CATALOG_GAPS.map((g) => g.region)).toEqual(
      expect.arrayContaining(['Kanto', 'Hoenn', 'Todas']),
    );
  });
});

describe.skipIf(!TEST_DATABASE_URL)('seed do catálogo (PostgreSQL)', () => {
  let prisma: PrismaClient;
  beforeAll(() => {
    prisma = testPrisma();
  });
  afterAll(async () => prisma.$disconnect());

  it('é idempotente', async () => {
    const n = await seedCatalog(prisma);
    await seedCatalog(prisma);
    expect(await prisma.huntCatalog.count()).toBe(n);
  });
});
