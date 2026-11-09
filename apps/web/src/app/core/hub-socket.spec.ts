import { TestBed } from '@angular/core/testing';
import { ApiClient } from './api.client';
import { AuthService } from './auth.service';
import { HubSocket, WEBSOCKET_FACTORY } from './hub-socket';

class FakeWs {
  static instances: FakeWs[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  constructor(readonly url: string) {
    FakeWs.instances.push(this);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = 3;
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }
  drop(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

describe('HubSocket', () => {
  let socket: HubSocket;
  let refresh: ReturnType<typeof vi.fn>;
  let auth: { markLost: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    FakeWs.instances = [];
    refresh = vi.fn().mockResolvedValue(true);
    auth = { markLost: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WEBSOCKET_FACTORY,
          useValue: (url: string) => new FakeWs(url) as unknown as WebSocket,
        },
        { provide: ApiClient, useValue: { refresh } },
        { provide: AuthService, useValue: auth },
      ],
    });
    socket = TestBed.inject(HubSocket);
  });

  afterEach(() => {
    socket.stop();
    vi.useRealTimers();
  });

  const last = () => FakeWs.instances.at(-1) as FakeWs;

  it('conecta em /ws da mesma origem e repassa mensagens v1', () => {
    const received: unknown[] = [];
    socket.onMessage((m) => received.push(m));
    socket.start();
    expect(last().url).toMatch(/^wss?:\/\/.+\/ws$/);
    last().open();
    expect(socket.state()).toBe('open');
    last().onmessage?.({ data: JSON.stringify({ v: 1, type: 'sync.state', state: {} }) });
    last().onmessage?.({ data: 'lixo' });
    expect(received).toHaveLength(1);
  });

  it('queda mostra estado de erro e reconecta com backoff (1 s, 2 s, 4 s)', () => {
    socket.start();
    last().open();
    last().drop();
    expect(socket.state()).toBe('error');
    expect(socket.retryInMs()).toBe(1000);
    vi.advanceTimersByTime(1000);
    expect(FakeWs.instances).toHaveLength(2);
    last().drop();
    expect(socket.retryInMs()).toBe(2000);
    vi.advanceTimersByTime(2000);
    last().drop();
    expect(socket.retryInMs()).toBe(4000);
  });

  it('backoff volta a 1 s depois de reconectar', () => {
    socket.start();
    last().drop();
    vi.advanceTimersByTime(1000);
    last().open();
    last().drop();
    expect(socket.retryInMs()).toBe(1000);
  });

  it('fechamento 4001 renova a sessão e reconecta; refresh recusado encerra a sessão', async () => {
    socket.start();
    last().open();
    last().drop(4001);
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledOnce();
    expect(FakeWs.instances).toHaveLength(2);

    refresh.mockResolvedValue(false);
    last().open();
    last().drop(4001);
    await vi.runAllTimersAsync();
    expect(auth.markLost).toHaveBeenCalledOnce();
    expect(socket.state()).toBe('idle');
  });

  it('send só envia com a conexão aberta', () => {
    socket.start();
    expect(socket.send({ v: 1, type: 'sync.all' })).toBe(false);
    last().open();
    expect(socket.send({ v: 1, type: 'sync.all' })).toBe(true);
  });
});
