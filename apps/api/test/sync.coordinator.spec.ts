import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AccountId, AccountView, SyncState } from '@pokeidle-hub/shared';
import { createApp } from '../src/app.js';
import { InMemoryRefreshTokenStore } from '../src/auth/refresh-token.store.js';
import { AccessTokenService } from '../src/auth/tokens.js';
import { HubEvents } from '../src/events/hub-events.js';
import { RespondingSink } from '../src/sync/responding-sink.js';
import { StaleMarks } from '../src/sync/stale-marks.js';
import type { StatusProvider } from '../src/sync/status-provider.js';
import { SyncCoordinator } from '../src/sync/sync.coordinator.js';
import { InMemorySink } from './support/fakes.js';
import { illustrativeSnapshot } from './support/snapshots.js';
import { TEST_ENV_VARS, silentLogger } from './helpers.js';

const TIMEOUT_MS = 80;

/** Ponte simulada: contas conectadas respondem (ou não) pelo sink, como a extensão faria. */
class SimulatedBridge implements StatusProvider {
  readonly kind = 'extension' as const;
  readonly requests: { accountId: AccountId; requestId: string }[] = [];
  sink: RespondingSink | null = null;
  private minute = 0;

  constructor(
    private readonly connected: ReadonlySet<AccountId>,
    private readonly silent: ReadonlySet<AccountId> = new Set(),
  ) {}

  canRequest(accountId: AccountId): boolean {
    return this.connected.has(accountId);
  }

  requestSnapshot(accountId: AccountId, requestId: string): boolean {
    this.requests.push({ accountId, requestId });
    if (!this.silent.has(accountId)) {
      const capturedAt = `2026-11-09T12:${String(this.minute++).padStart(2, '0')}:00Z`;
      setTimeout(
        () => void this.sink?.ingest(illustrativeSnapshot(accountId, capturedAt), new Date()),
        5,
      );
    }
    return true;
  }
}

function setup(connected: AccountId[], silent: AccountId[] = []) {
  const events = new HubEvents();
  const marks = new StaleMarks();
  const states: SyncState[] = [];
  const views: AccountView[] = [];
  events.on('sync.state', (s) => states.push(s));
  events.on('account.updated', (v) => views.push(v));
  const bridge = new SimulatedBridge(new Set(connected), new Set(silent));
  const coordinator = new SyncCoordinator({
    providers: [bridge],
    events,
    staleMarks: marks,
    views: {
      getView: (accountId) =>
        Promise.resolve({
          accountId,
          label: `Conta ${accountId}`,
          nick: null,
          snapshot: null,
          receivedAt: null,
          stale: marks.has(accountId),
        }),
    },
    logger: silentLogger(),
    timeoutMs: TIMEOUT_MS,
  });
  bridge.sink = new RespondingSink(new InMemorySink(), coordinator);
  const finished = (): Promise<SyncState> =>
    new Promise((resolve) => {
      events.on('sync.state', (s) => s.status === 'idle' && resolve(s));
    });
  return { events, marks, states, views, bridge, coordinator, finished };
}

describe('SyncCoordinator com ponte simulada', () => {
  it('todas as contas respondem: rodada termina antes do prazo', async () => {
    const h = setup([1, 2, 3, 4]);
    const done = h.finished();
    const started = h.coordinator.requestAll();
    expect(started.status).toBe('running');
    expect(started.accounts).toEqual({
      '1': 'pending',
      '2': 'pending',
      '3': 'pending',
      '4': 'pending',
    });
    const final = await done;
    expect(final.accounts).toEqual({ '1': 'ok', '2': 'ok', '3': 'ok', '4': 'ok' });
    expect(final.finishedAt).not.toBeNull();
    expect(new Set(h.bridge.requests.map((r) => r.requestId)).size).toBe(1);
  });

  it('conta sem ponte fica unavailable e marcada como obsoleta na hora', async () => {
    const h = setup([1, 2, 3]);
    const done = h.finished();
    h.coordinator.requestAll();
    const final = await done;
    expect(final.accounts['4']).toBe('unavailable');
    expect(h.marks.has(4)).toBe(true);
    expect(h.views.find((v) => v.accountId === 4)?.stale).toBe(true);
  });

  it('conta que não responde em 10 s (aqui, 80 ms) vira timeout e obsoleta', async () => {
    const h = setup([1, 2, 3, 4], [3]);
    const done = h.finished();
    const t0 = Date.now();
    h.coordinator.requestAll();
    const final = await done;
    expect(Date.now() - t0).toBeGreaterThanOrEqual(TIMEOUT_MS - 5);
    expect(final.accounts).toEqual({ '1': 'ok', '2': 'ok', '3': 'timeout', '4': 'ok' });
    expect(h.marks.has(3)).toBe(true);
  });

  it('ignora novo pedido enquanto uma rodada está em andamento', async () => {
    const h = setup([1, 2, 3, 4], [2]);
    const done = h.finished();
    h.coordinator.requestAll();
    h.coordinator.requestAll();
    h.coordinator.requestAll();
    await done;
    expect(h.bridge.requests).toHaveLength(4);
  });

  it('resposta posterior limpa a marca de obsoleto e republica a conta', async () => {
    const h = setup([1, 2, 3, 4], [3]);
    const done = h.finished();
    h.coordinator.requestAll();
    await done;
    h.views.length = 0;
    await h.bridge.sink?.ingest(illustrativeSnapshot(3, '2026-11-09T13:00:00Z'), new Date());
    await new Promise((r) => setTimeout(r, 10));
    expect(h.marks.has(3)).toBe(false);
    expect(h.views.at(-1)).toMatchObject({ accountId: 3, stale: false });
  });
});

describe('POST /sync', () => {
  let app: ReturnType<typeof createApp>;
  let tokens: AccessTokenService;
  let h: ReturnType<typeof setup>;

  beforeEach(() => {
    h = setup([1, 2, 3, 4]);
    tokens = new AccessTokenService('segredo-de-teste-com-mais-de-32-caracteres', 900);
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
      sync: h.coordinator,
    });
  });

  it('exige sessão', async () => {
    expect((await request(app).post('/sync')).status).toBe(401);
  });

  it('inicia a rodada e responde 202 com o estado', async () => {
    const done = h.finished();
    const { token } = await tokens.issue();
    const res = await request(app).post('/sync').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(202);
    expect(res.body.state.status).toBe('running');
    await done;
    const after = await request(app).get('/sync').set('Authorization', `Bearer ${token}`);
    expect(after.body.state.status).toBe('idle');
  });
});
