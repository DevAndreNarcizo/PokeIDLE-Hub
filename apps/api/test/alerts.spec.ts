import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AlertView } from '@pokeidle-hub/shared';
import { AccountRepository } from '../src/accounts/account.repository.js';
import { AlertService } from '../src/alerts/alert.service.js';
import { createApp } from '../src/app.js';
import { InMemoryRefreshTokenStore } from '../src/auth/refresh-token.store.js';
import { AccessTokenService } from '../src/auth/tokens.js';
import { DailyRepository } from '../src/daily/daily.repository.js';
import type { PrismaClient } from '../src/db/client.js';
import { HubEvents } from '../src/events/hub-events.js';
import { TEST_DATABASE_URL, resetDatabase, testPrisma } from './support/db.js';
import { illustrativeSnapshot } from './support/snapshots.js';
import { TEST_ENV_VARS, silentLogger } from './helpers.js';

const T0 = new Date('2026-11-09T15:00:00Z'); // 12:00 em Brasília

describe.skipIf(!TEST_DATABASE_URL)('ciclo de vida dos alertas (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let accounts: AccountRepository;
  let daily: DailyRepository;
  let events: HubEvents;
  let service: AlertService;
  let opened: AlertView[];
  let resolved: AlertView[];

  beforeAll(() => {
    prisma = testPrisma();
    accounts = new AccountRepository(prisma);
    daily = new DailyRepository(prisma);
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    events = new HubEvents();
    opened = [];
    resolved = [];
    events.on('alert.opened', (a) => opened.push(a));
    events.on('alert.resolved', (a) => resolved.push(a));
    service = new AlertService({
      prisma,
      views: accounts,
      daily,
      events,
      logger: silentLogger(),
      reminderAt: '18:00',
    });
  });
  afterAll(async () => prisma.$disconnect());

  async function store(status: 'hunting' | 'conflict', at: Date): Promise<void> {
    await accounts.saveIfNewer(illustrativeSnapshot(1, at.toISOString(), { status }), at);
  }

  it('abre uma vez, não duplica enquanto ativo e resolve quando a condição some', async () => {
    await store('conflict', T0);
    await service.evaluate(1, T0);
    await service.evaluate(1, new Date(T0.getTime() + 10_000));
    expect(opened.map((a) => a.kind)).toEqual(['session_conflict']);
    expect(await prisma.alert.count()).toBe(1);

    const later = new Date(T0.getTime() + 20_000);
    await store('hunting', later);
    await service.evaluate(1, later);
    expect(resolved.map((a) => a.kind)).toEqual(['session_conflict']);
    expect((await service.list('open', later)).length).toBe(0);
    expect((await service.list('recent', later)).map((a) => a.resolvedAt)).toEqual([
      later.toISOString(),
    ]);
  });

  it('reabre como novo alerta se a condição voltar', async () => {
    await store('conflict', T0);
    await service.evaluate(1, T0);
    const t1 = new Date(T0.getTime() + 10_000);
    await store('hunting', t1);
    await service.evaluate(1, t1);
    const t2 = new Date(T0.getTime() + 20_000);
    await store('conflict', t2);
    await service.evaluate(1, t2);
    expect(await prisma.alert.count()).toBe(2);
    expect(opened).toHaveLength(2);
  });

  it('avaliações simultâneas não duplicam (fila por conta + índice parcial)', async () => {
    await store('conflict', T0);
    await Promise.all(Array.from({ length: 6 }, () => service.evaluate(1, T0)));
    expect(await prisma.alert.count({ where: { resolvedAt: null } })).toBe(1);
  });

  it('dado obsoleto pelo relógio vira stale_data e substitui o conflito', async () => {
    await store('conflict', T0);
    await service.evaluate(1, T0);
    await service.evaluateAll(new Date(T0.getTime() + 61_000));
    expect(opened.map((a) => a.kind)).toEqual(['session_conflict', 'stale_data']);
    expect(resolved.map((a) => a.kind)).toEqual(['session_conflict']);
  });

  it('daily_pending abre depois das 18:00 com a tarefa pendente', async () => {
    await daily.recordFromSnapshot(
      illustrativeSnapshot(1, T0.toISOString(), {
        daily: { battlePassDay: 1, battlePassClaimedToday: true, topIdleVotedToday: false },
      }),
    );
    await service.evaluate(1, T0);
    expect(opened).toHaveLength(0);
    await service.evaluate(1, new Date('2026-11-09T21:05:00Z'));
    expect(opened[0]).toMatchObject({
      kind: 'daily_pending',
      payload: { tasks: ['topidle_vote'] },
    });
  });

  it('rotas: lista abertos e marca como visto', async () => {
    await store('conflict', T0);
    await service.evaluate(1, T0);
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
      alerts: service,
    });
    const list = await request(app).get('/alerts').set('Authorization', bearer);
    expect(list.body.alerts).toHaveLength(1);
    const id = list.body.alerts[0].id as string;
    const ack = await request(app).post(`/alerts/${id}/ack`).set('Authorization', bearer);
    expect(ack.body.alert.ackedAt).not.toBeNull();
    expect(
      (await request(app).post('/alerts/999999/ack').set('Authorization', bearer)).status,
    ).toBe(404);
    expect((await request(app).post('/alerts/abc/ack').set('Authorization', bearer)).status).toBe(
      404,
    );
    expect((await request(app).get('/alerts')).status).toBe(401);
  });
});
