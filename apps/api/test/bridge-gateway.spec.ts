import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { once } from 'node:events';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SyncState } from '@pokeidle-hub/shared';
import { WS_CLOSE } from '@pokeidle-hub/shared';
import { BridgeGateway } from '../src/bridge/bridge-gateway.js';
import { HubEvents } from '../src/events/hub-events.js';
import { RespondingSink } from '../src/sync/responding-sink.js';
import { StaleMarks } from '../src/sync/stale-marks.js';
import { SyncCoordinator } from '../src/sync/sync.coordinator.js';
import { attachWebSockets } from '../src/ws/attach.js';
import { FakeBridgeTokens, InMemorySink } from './support/fakes.js';
import { illustrativeSnapshot } from './support/snapshots.js';
import { TestWsClient, wsUrl } from './support/ws-client.js';
import { silentLogger } from './helpers.js';

// Tokens fictícios.
const TOKENS = { 'pih_ficticio-1': 1, 'pih_ficticio-2': 2 } as const;

describe('ponte /bridge (extensão)', () => {
  let server: Server;
  let bridge: BridgeGateway;
  let inner: InMemorySink;
  let coordinator: SyncCoordinator;
  let events: HubEvents;
  const clients: TestWsClient[] = [];

  beforeEach(async () => {
    events = new HubEvents();
    inner = new InMemorySink();
    const marks = new StaleMarks();
    const ref: { coordinator?: SyncCoordinator } = {};
    const sink = new RespondingSink(inner, {
      noteResponse: (id) => ref.coordinator?.noteResponse(id),
    });
    bridge = new BridgeGateway({
      tokens: new FakeBridgeTokens(TOKENS),
      sink,
      logger: silentLogger(),
      snapshotsPerMinute: 3,
      helloTimeoutMs: 100,
    });
    coordinator = new SyncCoordinator({
      providers: [bridge],
      events,
      staleMarks: marks,
      views: { getView: () => Promise.resolve(null) },
      logger: silentLogger(),
      timeoutMs: 300,
    });
    ref.coordinator = coordinator;
    server = createServer();
    attachWebSockets(server, { '/bridge': bridge }, silentLogger());
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
  });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.close());
    coordinator.dispose();
    bridge.close();
    server.close();
    await once(server, 'close');
  });

  async function open(): Promise<TestWsClient> {
    const client = await TestWsClient.connect(wsUrl(server, '/bridge'));
    clients.push(client);
    return client;
  }

  async function authed(token: keyof typeof TOKENS = 'pih_ficticio-1'): Promise<TestWsClient> {
    const client = await open();
    client.send({ v: 1, type: 'hello', token, extensionVersion: '0.1.0' });
    expect(await client.next()).toEqual({ v: 1, type: 'hello.ok', accountId: TOKENS[token] });
    return client;
  }

  it('autentica com hello e passa a aceitar pedidos', async () => {
    await authed();
    expect(bridge.canRequest(1)).toBe(true);
    expect(bridge.canRequest(2)).toBe(false);
  });

  it('fecha com 4003 para token inválido, mensagem antes do hello ou hello atrasado', async () => {
    const bad = await open();
    bad.send({ v: 1, type: 'hello', token: 'pih_errado', extensionVersion: '0.1.0' });
    expect(await bad.closed()).toBe(WS_CLOSE.bridgeAuthFailed);

    const early = await open();
    early.send({
      v: 1,
      type: 'snapshot',
      requestId: null,
      snapshot: illustrativeSnapshot(1, '2026-11-09T12:00:00Z'),
    });
    expect(await early.closed()).toBe(WS_CLOSE.bridgeAuthFailed);

    const silent = await open();
    expect(await silent.closed()).toBe(WS_CLOSE.bridgeAuthFailed);
  });

  it('entrega sync.request e grava o snapshot respondido, com ack', async () => {
    const client = await authed();
    expect(bridge.requestSnapshot(1, 'req-1')).toBe(true);
    expect(await client.next()).toEqual({ v: 1, type: 'sync.request', requestId: 'req-1' });
    client.send({
      v: 1,
      type: 'snapshot',
      requestId: 'req-1',
      snapshot: illustrativeSnapshot(1, '2026-11-09T12:00:00Z'),
    });
    expect(await client.next()).toEqual({
      v: 1,
      type: 'snapshot.ack',
      requestId: 'req-1',
      status: 'stored',
    });
    client.send({
      v: 1,
      type: 'snapshot',
      requestId: null,
      snapshot: illustrativeSnapshot(1, '2026-11-09T12:00:00Z'),
    });
    expect(await client.next()).toMatchObject({ type: 'snapshot.ack', status: 'duplicate' });
    expect(inner.stored).toHaveLength(1);
  });

  it('recusa snapshot de outra conta e snapshot inválido sem derrubar a conexão', async () => {
    const client = await authed();
    client.send({
      v: 1,
      type: 'snapshot',
      requestId: null,
      snapshot: illustrativeSnapshot(2, '2026-11-09T12:00:00Z'),
    });
    expect(await client.next()).toMatchObject({ type: 'error', code: 'account_mismatch' });
    client.send({ v: 1, type: 'snapshot', requestId: null, snapshot: { accountId: 1 } });
    expect(await client.next()).toMatchObject({ type: 'error', code: 'invalid_message' });
    expect(inner.stored).toHaveLength(0);
  });

  it('limita snapshots por minuto por conexão', async () => {
    const client = await authed();
    for (let i = 0; i < 3; i++) {
      client.send({
        v: 1,
        type: 'snapshot',
        requestId: null,
        snapshot: illustrativeSnapshot(1, `2026-11-09T12:0${i}:00Z`),
      });
      expect(await client.next()).toMatchObject({ type: 'snapshot.ack' });
    }
    client.send({
      v: 1,
      type: 'snapshot',
      requestId: null,
      snapshot: illustrativeSnapshot(1, '2026-11-09T12:09:00Z'),
    });
    expect(await client.next()).toMatchObject({ type: 'error', code: 'rate_limited' });
  });

  it('nova conexão da mesma conta substitui a anterior (4002)', async () => {
    const first = await authed();
    await authed();
    expect(await first.closed()).toBe(WS_CLOSE.replaced);
    expect(bridge.canRequest(1)).toBe(true);
  });

  it('ponta a ponta: sincronização com uma ponte que responde e uma conta sem ponte', async () => {
    const client = await authed();
    const done = new Promise<SyncState>((resolve) =>
      events.on('sync.state', (s) => s.status === 'idle' && resolve(s)),
    );
    coordinator.requestAll();
    const request = await client.next<{ requestId: string }>();
    client.send({
      v: 1,
      type: 'snapshot',
      requestId: request.requestId,
      snapshot: illustrativeSnapshot(1, '2026-11-09T12:00:00Z'),
    });
    const final = await done;
    expect(final.accounts).toEqual({
      '1': 'ok',
      '2': 'unavailable',
      '3': 'unavailable',
      '4': 'unavailable',
    });
  });

  it('conta deixa de estar disponível quando a ponte desconecta', async () => {
    const client = await authed();
    client.close();
    await client.closed();
    await new Promise((r) => setTimeout(r, 20));
    expect(bridge.canRequest(1)).toBe(false);
  });
});
