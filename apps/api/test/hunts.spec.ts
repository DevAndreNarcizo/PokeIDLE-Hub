import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AccountSnapshot } from '@pokeidle-hub/shared';
import { AccountRepository } from '../src/accounts/account.repository.js';
import { createApp } from '../src/app.js';
import { InMemoryRefreshTokenStore } from '../src/auth/refresh-token.store.js';
import { AccessTokenService } from '../src/auth/tokens.js';
import type { PrismaClient } from '../src/db/client.js';
import { HuntsService } from '../src/hunts/hunts.service.js';
import { ObservationRecorder } from '../src/hunts/observation.recorder.js';
import { outlandRares } from '../src/hunts/rares.js';
import { TEST_DATABASE_URL, resetDatabase, testPrisma } from './support/db.js';
import { illustrativeSnapshot } from './support/snapshots.js';
import { TEST_ENV_VARS, silentLogger } from './helpers.js';

const T0 = Date.parse('2026-11-09T12:00:00Z');
const at = (min: number) => new Date(T0 + min * 60_000).toISOString();

// FIXTURE ILUSTRATIVA: sessão com contadores cumulativos inventados.
function hunting(
  min: number,
  over: {
    region?: string;
    level?: number;
    kills?: number;
    gold?: number;
    species?: string;
    trainerLevel?: number;
  } = {},
): AccountSnapshot {
  return illustrativeSnapshot(1, at(min), {
    trainerLevel: over.trainerLevel ?? 377,
    hunt: { region: over.region ?? 'Johto', level: over.level ?? 350, name: null },
    activePokemon: {
      species: over.species ?? 'Ilustrativo',
      level: 380,
      types: ['Fire'],
      power: 2,
      quality: 1,
      ivs: { hp: 1, atk: 1, def: 1, spAtk: 1, spDef: 1, spd: 1 },
      stats: { hp: 1, atk: 1, def: 1, spAtk: 1, spDef: 1, spd: 1 },
      shiny: false,
    },
    session: {
      xpTrainerPerHour: 2_000_000,
      xpPokemonPerHour: 1_000_000,
      kills: over.kills ?? 0,
      captures: 0,
      gold: over.gold ?? 0,
      shinySeen: 0,
      shinyCaught: 0,
      rareDrops: null,
    },
  });
}

describe.skipIf(!TEST_DATABASE_URL)('medições e lista de hunts (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let accounts: AccountRepository;
  let recorder: ObservationRecorder;
  let hunts: HuntsService;

  beforeAll(() => {
    prisma = testPrisma();
    accounts = new AccountRepository(prisma);
    recorder = new ObservationRecorder(prisma);
    hunts = new HuntsService(prisma, accounts);
  });
  beforeEach(async () => resetDatabase(prisma));
  afterAll(async () => prisma.$disconnect());

  /** Leituras a cada 5 min de `from` a `to` (minutos), com contadores crescendo linearmente. */
  function series(
    from: number,
    to: number,
    perMin: { kills?: number; gold?: number },
    over: Parameters<typeof hunting>[1] = {},
  ): AccountSnapshot[] {
    const list: AccountSnapshot[] = [];
    for (let m = from; m <= to; m += 5) {
      list.push(
        hunting(m, {
          ...over,
          kills: Math.round((m - from) * (perMin.kills ?? 0)),
          gold: (m - from) * (perMin.gold ?? 0),
        }),
      );
    }
    return list;
  }

  async function feed(...snaps: AccountSnapshot[]): Promise<void> {
    for (const s of snaps) {
      await accounts.saveIfNewer(s, new Date(s.capturedAt));
      await recorder.record(s);
    }
  }

  it('estende o trecho contínuo e abre outro ao trocar hunt, pokemon, após intervalo ou reset do contador', async () => {
    await feed(hunting(0), hunting(1, { kills: 10 }), hunting(2, { kills: 20 }));
    expect(await prisma.huntObservation.count()).toBe(1);
    await feed(hunting(3, { level: 380, kills: 30 })); // outra hunt
    await feed(hunting(4, { level: 380, kills: 40, species: 'Outro' })); // outro pokemon
    await feed(hunting(20, { level: 380, kills: 50, species: 'Outro' })); // intervalo > 5 min
    await feed(hunting(21, { level: 380, kills: 1, species: 'Outro' })); // contador voltou
    expect(await prisma.huntObservation.count()).toBe(5);
  });

  it('ignora snapshot fora de hunt', async () => {
    await feed({ ...hunting(0), status: 'center' });
    expect(await prisma.huntObservation.count()).toBe(0);
  });

  it('métricas medidas: 500 abates e 3.000 de ouro em 30 min → 1.000 abates/h, 6.000 ouro/h, 24 h por shiny', async () => {
    // 500 abates e 3.000 de ouro em 30 min, leituras a cada 5 min.
    await feed(...series(0, 30, { kills: 500 / 30, gold: 100 }));
    const res = await hunts.list(1, 'xp', 'Johto', new Date(T0 + 31 * 60_000));
    const row = res.hunts.find((h) => h.level === 350);
    expect(row).toMatchObject({
      killsPerHour: 1000,
      goldPerHour: 6000,
      xpPerHour: 2_000_000,
      shinyHours: 24,
    });
    expect(row?.measured).toMatchObject({ hours: 0.5, samples: 1, species: 'Ilustrativo' });
    expect(row?.killTimeSeconds).toBeNull();
    expect(row?.riskPct).toBeNull();
    const other = res.hunts.find((h) => h.level === 200);
    expect(other).toMatchObject({ measured: null, xpPerHour: null, shinyHours: null });
  });

  it('trecho curto (< 10 min) não conta como medição', async () => {
    await feed(hunting(0, { kills: 0 }), hunting(5, { kills: 100 }));
    const res = await hunts.list(1, 'xp', 'Johto', new Date(T0 + 6 * 60_000));
    expect(res.hunts.find((h) => h.level === 350)?.measured).toBeNull();
  });

  it('hunts acima do nível do treinador nunca aparecem', async () => {
    await feed(hunting(0, { trainerLevel: 1_204 }));
    const res = await hunts.list(1, 'xp', null, new Date(T0 + 60_000));
    expect(res.hunts.length).toBeGreaterThan(0);
    expect(res.hunts.every((h) => h.level <= 1_204)).toBe(true);
    expect(
      res.hunts
        .filter((h) => h.outland !== null)
        .map((h) => h.name)
        .sort(),
    ).toEqual(['Outland 1', 'Outland 2']);
    expect(res.hunts.some((h) => h.region === 'Unova')).toBe(false);
  });

  it('Outland: medição vale para todas as Outlands liberadas e o shiny não rola', async () => {
    await feed(
      ...series(0, 30, { kills: 800 / 60 }, { region: 'Outland', level: 150, trainerLevel: 2_500 }),
    );
    const res = await hunts.list(1, 'rares', 'Outland', new Date(T0 + 31 * 60_000));
    expect(res.hunts.map((h) => h.name).sort()).toEqual(['Outland 1', 'Outland 2', 'Outland 3']);
    expect(res.hunts.every((h) => h.killsPerHour === 800 && h.shinyHours === null)).toBe(true);
  });

  it('raros/h por Outland liberada: multiplicador da tabela §4 sobre os abates medidos', async () => {
    const withRares = new HuntsService(prisma, accounts, outlandRares);
    // 1.000 abates/h medidos numa Outland; treinador nv 4.000 libera as Outlands 1 a 4.
    await feed(
      ...series(
        0,
        30,
        { kills: 1000 / 60 },
        { region: 'Outland', level: 150, trainerLevel: 4_000 },
      ),
    );
    const res = await withRares.list(1, 'rares', 'Outland', new Date(T0 + 31 * 60_000));
    const token = Object.fromEntries(res.hunts.map((h) => [h.name, h.rares?.bronzeBossToken]));
    expect(Object.keys(token).sort()).toEqual(['Outland 1', 'Outland 2', 'Outland 3', 'Outland 4']);
    expect(token['Outland 1']).toBeCloseTo(0.5, 6); // 0,05%
    expect(token['Outland 2']).toBeCloseTo(0.625, 6); // 0,0625%
    expect(token['Outland 4']).toBeCloseTo(1.0, 6); // 0,10%
    expect(res.hunts.find((h) => h.name === 'Outland 4')?.rares?.keyFragment).toBeCloseTo(0.01, 9);
    // Aba Raros/h ordena pelo token (Outland 4 primeiro).
    expect(res.hunts[0]?.name).toBe('Outland 4');
    // Fora da Outland não há raros.
    expect(
      (await withRares.list(1, 'rares', 'Johto', new Date(T0 + 31 * 60_000))).hunts.every(
        (h) => h.rares === null,
      ),
    ).toBe(true);
  });

  it('estados vazios: sem ficha e em conflito', async () => {
    expect((await hunts.list(2, 'xp', null, new Date(T0))).state).toBe('no_sheet');
    await accounts.saveIfNewer({ ...hunting(0), status: 'conflict' }, new Date(T0));
    expect((await hunts.list(1, 'xp', null, new Date(T0))).state).toBe('conflict');
  });

  it('ordena pela aba ativa com "sem medição" por último', async () => {
    await feed(...series(0, 20, { kills: 5 }, { level: 200 }));
    await feed(...series(21, 41, { kills: 15 }, { level: 230 }));
    const res = await hunts.list(1, 'shiny', 'Johto', new Date(T0 + 42 * 60_000));
    expect(res.hunts.slice(0, 2).map((h) => h.level)).toEqual([230, 200]);
    expect(res.hunts.slice(2).every((h) => h.shinyHours === null)).toBe(true);
  });

  it('rota GET /hunts valida parâmetros e exige sessão', async () => {
    const tokens = new AccessTokenService('segredo-de-teste-com-mais-de-32-caracteres', 900);
    const bearer = `Bearer ${(await tokens.issue()).token}`;
    const app = createApp({
      env: TEST_ENV_VARS,
      logger: silentLogger(),
      version: 'test',
      auth: {
        tokens,
        refreshStore: new InMemoryRefreshTokenStore(),
        verifyPassword: () => Promise.resolve(false),
        refreshTtlDays: 30,
        loginRateLimit: { max: 5, windowSeconds: 60 },
      },
      hunts,
    });
    expect((await request(app).get('/hunts?accountId=1')).status).toBe(401);
    expect((await request(app).get('/hunts?accountId=9').set('Authorization', bearer)).status).toBe(
      400,
    );
    expect(
      (await request(app).get('/hunts?accountId=1&metric=ranking').set('Authorization', bearer))
        .status,
    ).toBe(400);
    const ok = await request(app)
      .get('/hunts?accountId=1&metric=gold')
      .set('Authorization', bearer);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ accountId: 1, metric: 'gold', state: 'no_sheet' });
  });
});
