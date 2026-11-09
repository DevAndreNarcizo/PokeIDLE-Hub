import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { FakeBridgeTokens, InMemorySink } from './support/fakes.js';
import { illustrativeSnapshot } from './support/snapshots.js';
import { TEST_ENV_VARS, silentLogger } from './helpers.js';

// Tokens fictícios.
const TOKEN_1 = 'pih_token-ficticio-conta-1';
const TOKEN_2 = 'pih_token-ficticio-conta-2';

function build(ratePerMinute = 60): { app: ReturnType<typeof createApp>; sink: InMemorySink } {
  const sink = new InMemorySink();
  const app = createApp({
    env: TEST_ENV_VARS,
    logger: silentLogger(),
    version: 'test',
    ingest: {
      bridgeTokens: new FakeBridgeTokens({ [TOKEN_1]: 1, [TOKEN_2]: 2 }),
      sink,
      ratePerMinute,
    },
  });
  return { app, sink };
}

const post = (app: ReturnType<typeof createApp>, token: string | null, body: unknown) => {
  const req = request(app).post('/ingest/snapshot');
  return (token ? req.set('Authorization', `Bearer ${token}`) : req).send(body as object);
};

describe('POST /ingest/snapshot', () => {
  let h: ReturnType<typeof build>;
  beforeEach(() => {
    h = build();
  });

  it('grava snapshot válido (201)', async () => {
    const res = await post(h.app, TOKEN_1, illustrativeSnapshot(1, '2026-11-09T12:00:00Z'));
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ status: 'stored' });
    expect(h.sink.stored).toHaveLength(1);
  });

  it('rejeita snapshot inválido (400) com a lista de problemas', async () => {
    const res = await post(h.app, TOKEN_1, {
      ...illustrativeSnapshot(1, '2026-11-09T12:00:00Z'),
      status: 'x',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_snapshot');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.stringMatching(/^status:/)]),
    );
    expect(h.sink.stored).toHaveLength(0);
  });

  it('descarta duplicado ou mais antigo (200 duplicate)', async () => {
    await post(h.app, TOKEN_1, illustrativeSnapshot(1, '2026-11-09T12:00:00Z'));
    const same = await post(h.app, TOKEN_1, illustrativeSnapshot(1, '2026-11-09T12:00:00Z'));
    const older = await post(h.app, TOKEN_1, illustrativeSnapshot(1, '2026-11-09T11:59:00Z'));
    expect([same.status, same.body.status]).toEqual([200, 'duplicate']);
    expect([older.status, older.body.status]).toEqual([200, 'duplicate']);
    expect(h.sink.stored).toHaveLength(1);
  });

  it('recusa token ausente ou errado (401)', async () => {
    const snap = illustrativeSnapshot(1, '2026-11-09T12:00:00Z');
    expect((await post(h.app, null, snap)).status).toBe(401);
    expect((await post(h.app, 'pih_desconhecido', snap)).status).toBe(401);
    expect(h.sink.stored).toHaveLength(0);
  });

  it('recusa token de outra conta (403)', async () => {
    const res = await post(h.app, TOKEN_2, illustrativeSnapshot(1, '2026-11-09T12:00:00Z'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_mismatch');
  });

  it('limita a taxa por conta, sem afetar as outras', async () => {
    const limited = build(2);
    for (const minute of ['00', '01']) {
      expect(
        (await post(limited.app, TOKEN_1, illustrativeSnapshot(1, `2026-11-09T12:${minute}:00Z`)))
          .status,
      ).toBe(201);
    }
    expect(
      (await post(limited.app, TOKEN_1, illustrativeSnapshot(1, '2026-11-09T12:02:00Z'))).status,
    ).toBe(429);
    expect(
      (await post(limited.app, TOKEN_2, illustrativeSnapshot(2, '2026-11-09T12:02:00Z'))).status,
    ).toBe(201);
  });

  it('rejeita corpo acima do limite de tamanho (413)', async () => {
    const huge = { ...illustrativeSnapshot(1, '2026-11-09T12:00:00Z'), filler: 'x'.repeat(70_000) };
    expect((await post(h.app, TOKEN_1, huge)).status).toBe(413);
  });
});
