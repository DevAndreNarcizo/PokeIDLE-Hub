import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { AccountRepository } from '../src/accounts/account.repository.js';
import { InMemoryRefreshTokenStore } from '../src/auth/refresh-token.store.js';
import { AccessTokenService } from '../src/auth/tokens.js';
import { InMemorySink } from './support/fakes.js';
import { illustrativeSnapshot } from './support/snapshots.js';
import { TEST_ENV_VARS, silentLogger } from './helpers.js';

describe('POST /accounts/:id/snapshot (entrada manual)', () => {
  let app: ReturnType<typeof createApp>;
  let sink: InMemorySink;
  let bearer: string;

  beforeEach(async () => {
    sink = new InMemorySink();
    const tokens = new AccessTokenService('segredo-de-teste-com-mais-de-32-caracteres', 900);
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
      accounts: {
        accounts: {} as AccountRepository,
        manualSink: sink,
        focus: { focus: (id) => id === 1 },
      },
    });
  });

  const manual = (id: 1 | 2 | 3 | 4) =>
    illustrativeSnapshot(id, '2026-11-09T12:00:00Z', { source: 'manual' });

  it('exige sessão do painel', async () => {
    expect((await request(app).post('/accounts/1/snapshot').send(manual(1))).status).toBe(401);
  });

  it('grava snapshot manual da conta do caminho', async () => {
    const res = await request(app)
      .post('/accounts/2/snapshot')
      .set('Authorization', bearer)
      .send(manual(2));
    expect(res.status).toBe(201);
    expect(sink.stored[0]?.source).toBe('manual');
  });

  it('recusa conta divergente, origem não manual e conta inexistente', async () => {
    expect(
      (await request(app).post('/accounts/1/snapshot').set('Authorization', bearer).send(manual(2)))
        .status,
    ).toBe(400);
    const fromExtension = illustrativeSnapshot(1, '2026-11-09T12:00:00Z');
    expect(
      (
        await request(app)
          .post('/accounts/1/snapshot')
          .set('Authorization', bearer)
          .send(fromExtension)
      ).status,
    ).toBe(400);
    expect(
      (await request(app).post('/accounts/9/snapshot').set('Authorization', bearer).send(manual(1)))
        .status,
    ).toBe(404);
  });

  it('POST /accounts/:id/focus: 202 com ponte, 409 sem ponte, 401 sem sessão', async () => {
    expect((await request(app).post('/accounts/1/focus').set('Authorization', bearer)).status).toBe(
      202,
    );
    const missing = await request(app).post('/accounts/2/focus').set('Authorization', bearer);
    expect([missing.status, missing.body.error.code]).toEqual([409, 'bridge_unavailable']);
    expect((await request(app).post('/accounts/1/focus')).status).toBe(401);
  });
});
