/**
 * Cliente do WebSocket do painel (`/ws`): reconexão automática com backoff exponencial (1 s a
 * 30 s), estado de conexão em signal e renovação de sessão quando o servidor fecha com 4001.
 * Não depende do Angular além da injeção, para ser testável com um WebSocket falso.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import type { PanelClientMessage, PanelServerMessage } from '@pokeidle-hub/shared';
import { ApiClient } from './api.client';
import { AuthService } from './auth.service';

/** Código de fechamento "token expirado" (shared WS_CLOSE.tokenExpired). */
const CLOSE_TOKEN_EXPIRED = 4001;
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

/**
 * Estado da conexão: `error` = caiu e está aguardando nova tentativa.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type SocketState = 'idle' | 'connecting' | 'open' | 'error';

/**
 * Fábrica de WebSocket (substituível em testes).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const WEBSOCKET_FACTORY = new InjectionToken<(url: string) => WebSocket>(
  'WEBSOCKET_FACTORY',
  {
    providedIn: 'root',
    factory: () => (url: string) => new WebSocket(url),
  },
);

/**
 * Cliente do WebSocket do painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Injectable({ providedIn: 'root' })
export class HubSocket {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private readonly factory = inject(WEBSOCKET_FACTORY);

  readonly state = signal<SocketState>('idle');
  /** Próxima tentativa (ms), exibida no estado de erro. */
  readonly retryInMs = signal<number | null>(null);

  private socket: WebSocket | null = null;
  private backoff = BACKOFF_MIN_MS;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private readonly listeners = new Set<(message: PanelServerMessage) => void>();

  /**
   * Registra um ouvinte de mensagens do servidor.
   *
   * @param listener Função chamada a cada mensagem.
   * @returns Função para cancelar o registro.
   */
  onMessage(listener: (message: PanelServerMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Inicia (ou mantém) a conexão. */
  start(): void {
    this.stopped = false;
    if (!this.socket && this.retryTimer === null) {
      this.open();
    }
  }

  /** Encerra a conexão e as tentativas. */
  stop(): void {
    this.stopped = true;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, 'stop');
    this.state.set('idle');
  }

  /**
   * Envia um comando.
   *
   * @param message Mensagem do cliente.
   * @returns `true` se enviada (conexão aberta).
   */
  send(message: PanelClientMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.socket.send(JSON.stringify(message));
    return true;
  }

  private open(): void {
    this.state.set('connecting');
    this.retryInMs.set(null);
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let socket: WebSocket;
    try {
      socket = this.factory(`${protocol}//${location.host}/ws`);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.backoff = BACKOFF_MIN_MS;
      this.state.set('open');
    };
    socket.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data !== 'string') {
        return;
      }
      let message: PanelServerMessage;
      try {
        message = JSON.parse(event.data) as PanelServerMessage;
      } catch {
        return;
      }
      if (message.v === 1) {
        this.listeners.forEach((listener) => listener(message));
      }
    };
    socket.onclose = (event: CloseEvent) => {
      if (this.socket !== socket) {
        return;
      }
      this.socket = null;
      if (this.stopped) {
        return;
      }
      if (event.code === CLOSE_TOKEN_EXPIRED) {
        void this.renewAndReconnect();
        return;
      }
      this.scheduleRetry();
    };
  }

  private async renewAndReconnect(): Promise<void> {
    if (await this.api.refresh()) {
      this.open();
    } else {
      this.stop();
      this.auth.markLost();
    }
  }

  private scheduleRetry(): void {
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, BACKOFF_MAX_MS);
    this.state.set('error');
    this.retryInMs.set(delay);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.stopped) {
        this.open();
      }
    }, delay);
  }
}
