/**
 * Cliente da ponte no service worker: conecta ao `/bridge` do hub, autentica com o token da
 * conta, responde `sync.request` lendo a aba do jogo e reconecta com backoff. Não depende da API
 * `chrome` diretamente (recebe uma {@link BridgePlatform}), para ser testável.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountId, AccountSnapshot, BridgeClientMessage } from '@pokeidle-hub/shared';
import {
  PROTOCOL_VERSION,
  WS_CLOSE,
  accountSnapshotSchema,
  bridgeServerMessageSchema,
} from '@pokeidle-hub/shared';
import { offlineSnapshot } from './reader/read-snapshot.js';

/** Intervalo do ping que mantém o service worker ativo (precisa ser < 30 s). */
export const PING_INTERVAL_MS = 20_000;
/** Backoff de reconexão: 1 s, 2 s, 4 s … até 60 s. */
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;

/**
 * Configuração salva nas opções da extensão.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface BridgeConfig {
  hubUrl: string;
  token: string;
}

/**
 * Estado exibido na página de opções.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type BridgeStatus =
  | { state: 'unconfigured' }
  | { state: 'connecting' }
  | { state: 'connected'; accountId: AccountId }
  | { state: 'auth_failed' }
  | { state: 'replaced' }
  | { state: 'disconnected'; retryInMs: number };

/**
 * WebSocket mínimo usado pelo cliente (o do navegador atende).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface SocketLike {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

/**
 * Serviços do navegador de que o cliente precisa.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface BridgePlatform {
  openSocket(url: string): SocketLike;
  /** Lê a aba do jogo; `null` quando não há aba do jogo aberta neste perfil. */
  readGameTab(accountId: AccountId): Promise<unknown>;
  setStatus(status: BridgeStatus): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  now(): Date;
  version: string;
}

const OPEN = 1;

/**
 * Converte o endereço do hub (http/https) no endereço WebSocket da ponte.
 *
 * @param hubUrl Endereço base do hub.
 * @returns URL `ws(s)://.../bridge`.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function bridgeUrl(hubUrl: string): string {
  const url = new URL(hubUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/bridge`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

/**
 * Cliente da ponte.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class BridgeClient {
  private socket: SocketLike | null = null;
  private config: BridgeConfig | null = null;
  private accountId: AccountId | null = null;
  private retryHandle: unknown = null;
  private pingHandle: unknown = null;
  private backoffMs = BACKOFF_MIN_MS;
  /** Fechamentos definitivos: só voltam a conectar com nova configuração. */
  private halted = false;

  /**
   * @param platform Serviços do navegador.
   */
  constructor(private readonly platform: BridgePlatform) {}

  /**
   * Aplica uma configuração (nova ou alterada) e reconecta.
   *
   * @param config Configuração ou `null` se ausente.
   */
  configure(config: BridgeConfig | null): void {
    this.config = config;
    this.halted = false;
    this.backoffMs = BACKOFF_MIN_MS;
    this.disconnect();
    this.ensureConnected();
  }

  /** Garante uma conexão aberta (chamado também pelo alarme periódico). */
  ensureConnected(): void {
    if (!this.config) {
      this.platform.setStatus({ state: 'unconfigured' });
      return;
    }
    if (this.halted || this.socket || this.retryHandle !== null) {
      return;
    }
    this.platform.setStatus({ state: 'connecting' });
    let socket: SocketLike;
    try {
      socket = this.platform.openSocket(bridgeUrl(this.config.hubUrl));
    } catch {
      this.scheduleRetry();
      return;
    }
    this.socket = socket;
    const token = this.config.token;
    socket.onopen = () => {
      this.send({
        v: PROTOCOL_VERSION,
        type: 'hello',
        token,
        extensionVersion: this.platform.version,
      });
    };
    socket.onmessage = (event) => void this.onMessage(event.data);
    socket.onerror = () => undefined;
    socket.onclose = (event) => this.onClose(socket, event.code);
  }

  private async onMessage(data: unknown): Promise<void> {
    let json: unknown;
    try {
      json = typeof data === 'string' ? JSON.parse(data) : undefined;
    } catch {
      return;
    }
    const parsed = bridgeServerMessageSchema.safeParse(json);
    if (!parsed.success) {
      return;
    }
    const message = parsed.data;
    switch (message.type) {
      case 'hello.ok': {
        this.accountId = message.accountId as AccountId;
        this.backoffMs = BACKOFF_MIN_MS;
        this.platform.setStatus({ state: 'connected', accountId: this.accountId });
        this.startPing();
        break;
      }
      case 'sync.request': {
        if (this.accountId !== null) {
          const snapshot = await this.collect(this.accountId);
          this.send({
            v: PROTOCOL_VERSION,
            type: 'snapshot',
            requestId: message.requestId,
            snapshot,
          });
        }
        break;
      }
      case 'snapshot.ack':
      case 'error':
        break;
    }
  }

  /** Lê a aba; sem aba (ou leitura inválida) responde `offline`, nunca dado inventado. */
  private async collect(accountId: AccountId): Promise<AccountSnapshot> {
    try {
      const raw = await this.platform.readGameTab(accountId);
      const parsed = accountSnapshotSchema.safeParse(raw);
      if (parsed.success && parsed.data.accountId === accountId) {
        return parsed.data;
      }
    } catch {
      // Aba fechando ou content script ainda não carregado: tratado como sem sessão.
    }
    return offlineSnapshot(accountId, this.platform.now());
  }

  private onClose(socket: SocketLike, code: number): void {
    if (this.socket !== socket) {
      return;
    }
    this.socket = null;
    this.accountId = null;
    this.stopPing();
    if (code === WS_CLOSE.bridgeAuthFailed) {
      this.halted = true;
      this.platform.setStatus({ state: 'auth_failed' });
      return;
    }
    if (code === WS_CLOSE.replaced) {
      this.halted = true;
      this.platform.setStatus({ state: 'replaced' });
      return;
    }
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX_MS);
    this.platform.setStatus({ state: 'disconnected', retryInMs: delay });
    this.retryHandle = this.platform.setTimeout(() => {
      this.retryHandle = null;
      this.ensureConnected();
    }, delay);
  }

  private disconnect(): void {
    if (this.retryHandle !== null) {
      this.platform.clearTimeout(this.retryHandle);
      this.retryHandle = null;
    }
    this.stopPing();
    const socket = this.socket;
    this.socket = null;
    this.accountId = null;
    socket?.close(1000, 'reconfigure');
  }

  private startPing(): void {
    this.stopPing();
    this.pingHandle = this.platform.setInterval(
      () => this.send({ v: PROTOCOL_VERSION, type: 'ping' }),
      PING_INTERVAL_MS,
    );
  }

  private stopPing(): void {
    if (this.pingHandle !== null) {
      this.platform.clearInterval(this.pingHandle);
      this.pingHandle = null;
    }
  }

  private send(message: BridgeClientMessage): void {
    if (this.socket?.readyState === OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}
