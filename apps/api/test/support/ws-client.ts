/**
 * Cliente WebSocket de teste que enfileira mensagens JSON e permite aguardar a próxima.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { WebSocket } from 'ws';

/** Endereço `ws://` de um servidor HTTP já escutando. */
export function wsUrl(server: Server, path: string): string {
  const { port } = server.address() as AddressInfo;
  return `ws://127.0.0.1:${port}${path}`;
}

/** Cliente com fila de mensagens. */
export class TestWsClient {
  private readonly queue: unknown[] = [];
  private readonly waiters: ((msg: unknown) => void)[] = [];

  private constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const msg: unknown = JSON.parse(String(data));
      const waiter = this.waiters.shift();
      if (waiter) {
        waiter(msg);
      } else {
        this.queue.push(msg);
      }
    });
  }

  /** Conecta e aguarda a abertura. */
  static async connect(url: string, headers: Record<string, string> = {}): Promise<TestWsClient> {
    const socket = new WebSocket(url, { headers });
    const client = new TestWsClient(socket);
    await once(socket, 'open');
    return client;
  }

  /** Próxima mensagem (com prazo). */
  next<T = Record<string, unknown>>(timeoutMs = 2_000): Promise<T> {
    const queued = this.queue.shift();
    if (queued !== undefined) {
      return Promise.resolve(queued as T);
    }
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('sem mensagem no prazo')), timeoutMs);
      this.waiters.push((msg) => {
        clearTimeout(timer);
        resolve(msg as T);
      });
    });
  }

  send(message: unknown): void {
    this.socket.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  /** Aguarda o fechamento e devolve o código. */
  async closed(): Promise<number> {
    if (this.socket.readyState === WebSocket.CLOSED) {
      return -1;
    }
    const [code] = (await once(this.socket, 'close')) as [number];
    return code;
  }

  close(): void {
    this.socket.close();
  }
}

/** Tenta conectar e devolve o status HTTP da recusa (ou 101 se abriu). */
export async function upgradeStatus(
  url: string,
  headers: Record<string, string> = {},
): Promise<number> {
  const socket = new WebSocket(url, { headers });
  return new Promise<number>((resolve) => {
    socket.on('open', () => {
      socket.close();
      resolve(101);
    });
    socket.on('unexpected-response', (_req, res) => {
      resolve(res.statusCode ?? 0);
      socket.terminate();
    });
    socket.on('error', () => undefined);
  });
}
