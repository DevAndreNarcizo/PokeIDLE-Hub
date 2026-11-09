import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { InMemoryRefreshTokenStore } from '../src/auth/refresh-token.store.js';
import { AccessTokenService } from '../src/auth/tokens.js';
import type { PrismaClient } from '../src/db/client.js';
import { HistoryRepository } from '../src/history/history.repository.js';
import { RetentionJob } from '../src/jobs/retention.job.js';
import { TEST_DATABASE_URL, resetDatabase, testPrisma } from './support/db.js';
import { TEST_ENV_VARS, silentLogger } from './helpers.js';

const NOW = new Date('2026-11-09T12:00:00Z');

/**
 * Popula `snapshots` com uma série sintética (FIXTURE ILUSTRATIVA, valores inventados) a cada
 * `stepSeconds`, de `days` dias atrás até NOW, direto no SQL para ser rápido.
 */
async function seedSeries(
  prisma: PrismaClient,
  accountId: number,
  days: number,
  stepSeconds: number,
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO snapshots (account_id, captured_at, status, xp_trainer_per_hour, xp_pokemon_per_hour, payload)
    SELECT ${accountId}, t, 'hunting', 1000 + extract(epoch FROM t)::bigint % 997, 500,
           jsonb_build_object('trainerLevel', 377, 'session', jsonb_build_object('kills', 10, 'gold', 99))
    FROM generate_series(${NOW}::timestamptz - make_interval(secs => ${Math.round(days * 86_400)}), ${NOW}::timestamptz,
                         make_interval(secs => ${stepSeconds})) AS t`;
}

describe.skipIf(!TEST_DATABASE_URL)('histórico e retenção (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let history: HistoryRepository;
  let app: ReturnType<typeof createApp>;
  let bearer: string;

  beforeAll(async () => {
    prisma = testPrisma();
    history = new HistoryRepository(prisma);
    const tokens = new AccessTokenService(
      'segredo-de-teste-com-mais-de-32-caracteres',
      900,
      () => NOW,
    );
    bearer = `Bearer ${(await tokens.issue()).token}`;
    app = createApp({
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
      history: { history, now: () => NOW },
    });
  });
  beforeEach(async () => resetDatabase(prisma));
  afterAll(async () => prisma.$disconnect());

  it('devolve a série em ordem cronológica, inclusive métricas do payload', async () => {
    await seedSeries(prisma, 1, 0.01, 60); // ~15 pontos
    const xp = await history.series(
      1,
      new Date(NOW.getTime() - 3_600_000),
      NOW,
      'xpTrainerPerHour',
    );
    expect(xp.length).toBeGreaterThan(10);
    expect(xp.map((p) => p.capturedAt)).toEqual([...xp.map((p) => p.capturedAt)].sort());
    const gold = await history.series(1, new Date(NOW.getTime() - 3_600_000), NOW, 'gold');
    expect(gold.every((p) => p.value === 99)).toBe(true);
  });

  it('rota: padrão de 24 h, validação de métrica, intervalo e conta', async () => {
    await seedSeries(prisma, 2, 2, 600);
    const ok = await request(app).get('/accounts/2/history').set('Authorization', bearer);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      accountId: 2,
      metric: 'xpTrainerPerHour',
      from: '2026-11-08T12:00:00.000Z',
    });
    expect(ok.body.points).toHaveLength(145); // 24 h a cada 10 min, inclusive nas pontas
    const get = (q: string) =>
      request(app).get(`/accounts/2/history${q}`).set('Authorization', bearer);
    expect((await get('?metric=senha')).status).toBe(400);
    expect((await get('?from=2026-01-01T00:00:00Z')).body.error.code).toBe('invalid_range');
    expect((await get('?from=2026-11-09T12:00:00Z&to=2026-11-09T11:00:00Z')).status).toBe(400);
    expect(
      (await request(app).get('/accounts/7/history').set('Authorization', bearer)).status,
    ).toBe(404);
    expect((await request(app).get('/accounts/2/history')).status).toBe(401);
  });

  it('desempenho: 24 h de uma conta em ≤ 300 ms com 30 dias de histórico das 4 contas', async () => {
    // 30 dias × 4 contas a cada 30 s ≈ 345 mil linhas.
    for (const accountId of [1, 2, 3, 4]) {
      await seedSeries(prisma, accountId, 30, 30);
    }
    await prisma.$executeRawUnsafe('ANALYZE snapshots');
    await request(app).get('/accounts/1/history').set('Authorization', bearer); // aquece conexão
    const started = performance.now();
    const res = await request(app).get('/accounts/1/history').set('Authorization', bearer);
    const elapsed = performance.now() - started;
    expect(res.status).toBe(200);
    expect(res.body.points).toHaveLength(2881);
    expect(elapsed).toBeLessThanOrEqual(300);
  }, 60_000);

  it('retenção apaga só o que passou de N dias', async () => {
    await seedSeries(prisma, 1, 40, 3600);
    const job = new RetentionJob({
      history,
      retentionDays: 30,
      logger: silentLogger(),
      now: () => NOW,
    });
    const deleted = await job.runOnce();
    expect(deleted).toBe(240); // 10 dias × 24 h
    const oldest = await prisma.snapshot.findFirstOrThrow({ orderBy: { capturedAt: 'asc' } });
    expect(oldest.capturedAt.toISOString()).toBe('2026-10-10T12:00:00.000Z');
    expect(await job.runOnce()).toBe(0);
  });
});
