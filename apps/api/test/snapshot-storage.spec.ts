import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AccountView } from '@pokeidle-hub/shared';
import { AccountRepository } from '../src/accounts/account.repository.js';
import { createApp } from '../src/app.js';
import { AccessTokenService } from '../src/auth/tokens.js';
import { InMemoryRefreshTokenStore } from '../src/auth/refresh-token.store.js';
import type { PrismaClient } from '../src/db/client.js';
import { HubEvents } from '../src/events/hub-events.js';
import { SnapshotService } from '../src/ingest/snapshot.service.js';
import { TEST_DATABASE_URL, resetDatabase, testPrisma } from './support/db.js';
import { illustrativeSnapshot } from './support/snapshots.js';
import { TEST_ENV_VARS, silentLogger } from './helpers.js';

const NOW = new Date('2026-11-09T12:00:30Z');

describe.skipIf(!TEST_DATABASE_URL)('armazenamento de snapshots (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let repo: AccountRepository;
  let events: HubEvents;
  let service: SnapshotService;
  let emitted: AccountView[];

  beforeAll(() => {
    prisma = testPrisma();
    repo = new AccountRepository(prisma);
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    events = new HubEvents();
    emitted = [];
    events.on('account.updated', (view) => emitted.push(view));
    service = new SnapshotService(repo, events, () => NOW);
  });
  afterAll(async () => prisma.$disconnect());

  it('grava estado atual e histórico e publica account.updated', async () => {
    const outcome = await service.ingest(illustrativeSnapshot(1, '2026-11-09T12:00:00Z'), NOW);
    expect(outcome).toBe('stored');
    expect(await prisma.snapshot.count()).toBe(1);
    const state = await prisma.accountState.findUniqueOrThrow({ where: { accountId: 1 } });
    expect(state.capturedAt.toISOString()).toBe('2026-11-09T12:00:00.000Z');
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ accountId: 1, stale: false, receivedAt: NOW.toISOString() });
  });

  it('é idempotente: mesmo capturedAt ou mais antigo é descartado', async () => {
    await service.ingest(illustrativeSnapshot(1, '2026-11-09T12:00:00Z'), NOW);
    expect(await service.ingest(illustrativeSnapshot(1, '2026-11-09T12:00:00Z'), NOW)).toBe(
      'duplicate',
    );
    expect(await service.ingest(illustrativeSnapshot(1, '2026-11-09T11:00:00Z'), NOW)).toBe(
      'duplicate',
    );
    expect(await prisma.snapshot.count()).toBe(1);
    expect(emitted).toHaveLength(1);
  });

  it('snapshot mais novo substitui o estado e acrescenta ao histórico', async () => {
    await service.ingest(illustrativeSnapshot(1, '2026-11-09T12:00:00Z'), NOW);
    await service.ingest(
      illustrativeSnapshot(1, '2026-11-09T12:00:30Z', { status: 'center' }),
      NOW,
    );
    expect(await prisma.snapshot.count()).toBe(2);
    const [view] = await repo.listViews(NOW);
    expect(view?.snapshot?.status).toBe('center');
  });

  it('envios simultâneos do mesmo snapshot gravam uma única vez', async () => {
    const snap = illustrativeSnapshot(2, '2026-11-09T12:00:00Z');
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => service.ingest(snap, NOW)));
    expect(outcomes.filter((o) => o === 'stored')).toHaveLength(1);
    expect(await prisma.snapshot.count({ where: { accountId: 2 } })).toBe(1);
  });

  it('as contas são independentes', async () => {
    await service.ingest(illustrativeSnapshot(1, '2026-11-09T12:00:00Z'), NOW);
    expect(await service.ingest(illustrativeSnapshot(3, '2026-11-09T12:00:00Z'), NOW)).toBe(
      'stored',
    );
  });

  it('GET /accounts devolve as 4 contas, com obsoleto para quem nunca enviou', async () => {
    await service.ingest(illustrativeSnapshot(1, '2026-11-09T12:00:00Z'), NOW);
    const tokens = new AccessTokenService(
      'segredo-de-teste-com-mais-de-32-caracteres',
      900,
      () => NOW,
    );
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
      accounts: { accounts: repo, now: () => NOW },
    });
    expect((await request(app).get('/accounts')).status).toBe(401);
    const { token } = await tokens.issue();
    const res = await request(app).get('/accounts').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const views = res.body.accounts as AccountView[];
    expect(views.map((v) => v.accountId)).toEqual([1, 2, 3, 4]);
    expect(views[0]).toMatchObject({ label: 'Conta 1', stale: false });
    expect(views[0]?.snapshot?.trainerLevel).toBe(377);
    expect(views[1]).toMatchObject({ snapshot: null, receivedAt: null, stale: true });
  });
});
