import { beforeEach, describe, expect, it } from 'vitest';
import type { AccountId } from '@pokeidle-hub/shared';
import { WS_CLOSE } from '@pokeidle-hub/shared';
import { BridgeClient, PING_INTERVAL_MS, bridgeUrl } from '../src/bridge-client.js';
import type { BridgePlatform, BridgeStatus, SocketLike } from '../src/bridge-client.js';
import { parseConfig } from '../src/config.js';

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {}
  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close(code = 1000): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

/** Plataforma falsa com relógio manual. */
class FakePlatform implements BridgePlatform {
  sockets: FakeSocket[] = [];
  statuses: BridgeStatus[] = [];
  timers: { fn: () => void; ms: number; repeat: boolean; id: number }[] = [];
  tab: unknown = null;
  version = '0.1.0-test';
  private seq = 0;
  openSocket(url: string): SocketLike {
    const s = new FakeSocket(url);
    this.sockets.push(s);
    return s;
  }
  readGameTab(): Promise<unknown> {
    return Promise.resolve(this.tab);
  }
  setStatus(status: BridgeStatus): void {
    this.statuses.push(status);
  }
  setTimeout(fn: () => void, ms: number): unknown {
    const id = ++this.seq;
    this.timers.push({ fn, ms, repeat: false, id });
    return id;
  }
  clearTimeout(handle: unknown): void {
    this.timers = this.timers.filter((t) => t.id !== handle);
  }
  setInterval(fn: () => void, ms: number): unknown {
    const id = ++this.seq;
    this.timers.push({ fn, ms, repeat: true, id });
    return id;
  }
  clearInterval(handle: unknown): void {
    this.clearTimeout(handle);
  }
  now(): Date {
    return new Date('2026-11-09T12:00:00Z');
  }
  /** Dispara o primeiro temporizador pendente. */
  fire(): number {
    const timer = this.timers.find((t) => !t.repeat) ?? this.timers[0];
    if (!timer) throw new Error('nenhum temporizador');
    if (!timer.repeat) this.timers = this.timers.filter((t) => t !== timer);
    timer.fn();
    return timer.ms;
  }
  get last(): FakeSocket {
    const s = this.sockets.at(-1);
    if (!s) throw new Error('sem socket');
    return s;
  }
  get lastStatus(): BridgeStatus | undefined {
    return this.statuses.at(-1);
  }
}

const CONFIG = { hubUrl: 'https://hub.exemplo.test', token: 'pih_ficticio' };
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('BridgeClient', () => {
  let platform: FakePlatform;
  let client: BridgeClient;

  beforeEach(() => {
    platform = new FakePlatform();
    client = new BridgeClient(platform);
  });

  function connected(accountId: AccountId = 2): FakeSocket {
    client.configure(CONFIG);
    const socket = platform.last;
    socket.open();
    socket.receive({ v: 1, type: 'hello.ok', accountId });
    return socket;
  }

  it('sem configuração fica "unconfigured" e não conecta', () => {
    client.configure(null);
    expect(platform.sockets).toHaveLength(0);
    expect(platform.lastStatus).toEqual({ state: 'unconfigured' });
  });

  it('conecta em wss://.../bridge e envia hello com o token', () => {
    const socket = connected();
    expect(socket.url).toBe('wss://hub.exemplo.test/bridge');
    expect(socket.sent[0]).toEqual({
      v: 1,
      type: 'hello',
      token: 'pih_ficticio',
      extensionVersion: '0.1.0-test',
    });
    expect(platform.lastStatus).toEqual({ state: 'connected', accountId: 2 });
  });

  it('responde sync.request com o snapshot lido da aba', async () => {
    const socket = connected(2);
    platform.tab = { ...offline(2), status: 'conflict' };
    socket.receive({ v: 1, type: 'sync.request', requestId: 'req-9' });
    await flush();
    expect(socket.sent.at(-1)).toMatchObject({
      type: 'snapshot',
      requestId: 'req-9',
      snapshot: { accountId: 2, status: 'conflict' },
    });
  });

  it('sem aba do jogo, ou leitura inválida/de outra conta, responde offline', async () => {
    const socket = connected(2);
    for (const tab of [null, { lixo: true }, { ...offline(3), status: 'hunting' }]) {
      platform.tab = tab;
      socket.receive({ v: 1, type: 'sync.request', requestId: 'r' });
      await flush();
      expect(socket.sent.at(-1)).toMatchObject({
        type: 'snapshot',
        snapshot: { accountId: 2, status: 'offline' },
      });
    }
  });

  it('envia ping periódico depois de autenticar', () => {
    const socket = connected();
    const ping = platform.timers.find((t) => t.repeat);
    expect(ping?.ms).toBe(PING_INTERVAL_MS);
    ping?.fn();
    expect(socket.sent.at(-1)).toEqual({ v: 1, type: 'ping' });
  });

  it('token recusado (4003) para de tentar até nova configuração', () => {
    const socket = connected();
    socket.close(WS_CLOSE.bridgeAuthFailed);
    expect(platform.lastStatus).toEqual({ state: 'auth_failed' });
    client.ensureConnected();
    expect(platform.sockets).toHaveLength(1);
    client.configure(CONFIG);
    expect(platform.sockets).toHaveLength(2);
  });

  it('queda de conexão reconecta com backoff exponencial', () => {
    connected().close(1006);
    expect(platform.fire()).toBe(1_000);
    expect(platform.sockets).toHaveLength(2);
    platform.last.close(1006);
    expect(platform.fire()).toBe(2_000);
    platform.last.close(1006);
    expect(platform.fire()).toBe(4_000);
    expect(platform.sockets).toHaveLength(4);
  });
});

describe('configuração', () => {
  it('converte o endereço do hub para a URL da ponte', () => {
    expect(bridgeUrl('https://hub.exemplo.test/')).toBe('wss://hub.exemplo.test/bridge');
    expect(bridgeUrl('http://localhost:3000')).toBe('ws://localhost:3000/bridge');
    expect(bridgeUrl('https://exemplo.test/hub?x=1')).toBe('wss://exemplo.test/hub/bridge');
  });

  it('exige HTTPS (exceto localhost) e token com prefixo pih_', () => {
    expect(parseConfig(CONFIG)).toEqual(CONFIG);
    expect(parseConfig({ hubUrl: 'http://localhost:3000', token: 'pih_x' })).not.toBeNull();
    expect(parseConfig({ hubUrl: 'http://hub.exemplo.test', token: 'pih_x' })).toBeNull();
    expect(parseConfig({ hubUrl: 'https://hub.exemplo.test', token: 'sem-prefixo' })).toBeNull();
    expect(parseConfig('lixo')).toBeNull();
  });
});

function offline(accountId: AccountId) {
  return {
    accountId,
    capturedAt: '2026-11-09T12:00:00.000Z',
    source: 'extension',
    status: 'offline',
    trainerLevel: null,
    hunt: null,
    team: [],
    activePokemon: null,
    session: null,
    inventory: null,
    boosts: [],
    automations: null,
    daily: null,
    seasonalTypeOfDay: null,
  };
}
