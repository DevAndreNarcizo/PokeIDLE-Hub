import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { once } from 'node:events';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AccountView, SyncState } from '@pokeidle-hub/shared';
import { WS_CLOSE, initialSyncState } from '@pokeidle-hub/shared';
import { AccessTokenService } from '../src/auth/tokens.js';
import { HubEvents } from '../src/events/hub-events.js';
import type { SyncControl } from '../src/sync/sync-control.js';
import { attachWebSockets } from '../src/ws/attach.js';
import { PanelGateway } from '../src/ws/panel-gateway.js';
import { TestWsClient, upgradeStatus, wsUrl } from './support/ws-client.js';
import { silentLogger } from './helpers.js';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
const ORIGIN = 'http://localhost:4200';

class FakeSync implements SyncControl {
  calls = 0;
  getState(): SyncState {
    return initialSyncState();
  }
  requestAll(): SyncState {
    this.calls += 1;
    return initialSyncState();
  }
}

const view: AccountView = {
  accountId: 2,
  label: 'Conta 2',
  nick: null,
  snapshot: null,
  receivedAt: '2026-11-09T12:00:00.000Z',
  stale: false,
};

describe('WebSocket /ws do painel', () => {
  let server: Server;
  let gateway: PanelGateway;
  let events: HubEvents;
  let sync: FakeSync;
  let tokens: AccessTokenService;
  const clients: TestWsClient[] = [];

  beforeEach(async () => {
    events = new HubEvents();
    sync = new FakeSync();
    tokens = new AccessTokenService(SECRET, 900);
    gateway = new PanelGateway({
      tokens,
      events,
      sync,
      allowedOrigin: ORIGIN,
      logger: silentLogger(),
    });
    server = createServer();
    attachWebSockets(server, { '/ws': gateway }, silentLogger());
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
  });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.close());
    gateway.close();
    server.close();
    await once(server, 'close');
  });

  async function connect(token?: string): Promise<TestWsClient> {
    const access = token ?? (await tokens.issue()).token;
    const client = await TestWsClient.connect(wsUrl(server, '/ws'), {
      Cookie: `hub_at=${access}`,
      Origin: ORIGIN,
    });
    clients.push(client);
    return client;
  }

  it('envia o estado da sincronização ao conectar', async () => {
    const client = await connect();
    expect(await client.next()).toEqual({ v: 1, type: 'sync.state', state: initialSyncState() });
  });

  it('difunde account.updated e sync.state para todos os painéis', async () => {
    const a = await connect();
    const b = await connect();
    await a.next();
    await b.next();
    events.emit('account.updated', view);
    expect(await a.next()).toEqual({ v: 1, type: 'account.updated', account: view });
    expect(await b.next()).toEqual({ v: 1, type: 'account.updated', account: view });
    const running: SyncState = {
      ...initialSyncState(),
      status: 'running',
      startedAt: '2026-11-09T12:00:00.000Z',
    };
    events.emit('sync.state', running);
    expect(await a.next()).toEqual({ v: 1, type: 'sync.state', state: running });
  });

  it('aceita sync.all e responde erro para mensagem inválida', async () => {
    const client = await connect();
    await client.next();
    client.send({ v: 1, type: 'sync.all' });
    client.send({ v: 2, type: 'sync.all' });
    client.send('não é json');
    expect(await client.next()).toMatchObject({ type: 'error', code: 'invalid_message' });
    expect(await client.next()).toMatchObject({ type: 'error', code: 'invalid_message' });
    expect(sync.calls).toBe(1);
  });

  it('recusa upgrade sem cookie, com token inválido ou de outra origem', async () => {
    const url = wsUrl(server, '/ws');
    const { token } = await tokens.issue();
    expect(await upgradeStatus(url)).toBe(401);
    expect(await upgradeStatus(url, { Cookie: 'hub_at=invalido' })).toBe(401);
    expect(
      await upgradeStatus(url, { Cookie: `hub_at=${token}`, Origin: 'https://malicioso.example' }),
    ).toBe(403);
    expect(await upgradeStatus(wsUrl(server, '/outro'), { Cookie: `hub_at=${token}` })).toBe(404);
  });

  it('fecha com 4001 quando o token de acesso expira', async () => {
    const shortLived = new AccessTokenService(SECRET, 1);
    const client = await connect((await shortLived.issue()).token);
    expect(await client.closed()).toBe(WS_CLOSE.tokenExpired);
  });

  it('para de difundir depois de close()', async () => {
    gateway.close();
    expect(events.listenerCount('account.updated')).toBe(0);
  });
});
