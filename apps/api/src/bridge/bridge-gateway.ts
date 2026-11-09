/**
 * Ponte da extensão (WebSocket `/bridge`): implementa o {@link StatusProvider} do tipo
 * `extension`. Cada perfil do Brave (uma conta) mantém uma conexão autenticada pelo token da
 * conta; a API envia `sync.request` e recebe `snapshot`. Uma conexão por conta: a mais nova
 * substitui a anterior (código 4002).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import type { RawData } from 'ws';
import type { AccountId, BridgeServerMessage } from '@pokeidle-hub/shared';
import { PROTOCOL_VERSION, WS_CLOSE, bridgeClientMessageSchema } from '@pokeidle-hub/shared';
import type { SnapshotSink } from '../ingest/snapshot-sink.js';
import type { Logger } from '../logger.js';
import type { StatusProvider } from '../sync/status-provider.js';
import { rawToString } from '../ws/panel-gateway.js';
import type { BridgeTokenResolver } from './bridge-token.service.js';

/** Snapshot completo cabe com folga em 64 KiB (mesmo limite do HTTP). */
const MAX_BRIDGE_MESSAGE_BYTES = 64 * 1024;
/** Prazo para a extensão enviar `hello`. */
const HELLO_TIMEOUT_MS = 5_000;
/** Ping de vida (mantém o service worker do MV3 acordado e detecta conexões mortas). */
const HEARTBEAT_MS = 20_000;

/**
 * Dependências da ponte.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface BridgeGatewayDeps {
  tokens: BridgeTokenResolver;
  sink: SnapshotSink;
  logger: Logger;
  /** Mensagens `snapshot` aceitas por conexão por minuto. */
  snapshotsPerMinute: number;
  /** Prazo para o `hello` (padrão 5 s). */
  helloTimeoutMs?: number;
  now?: () => Date;
}

interface BridgeConnection {
  socket: WebSocket;
  accountId: AccountId | null;
  alive: boolean;
  windowStart: number;
  windowCount: number;
}

/**
 * Gateway WebSocket da ponte.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class BridgeGateway implements StatusProvider {
  readonly kind = 'extension' as const;
  private readonly wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_BRIDGE_MESSAGE_BYTES,
  });
  private readonly byAccount = new Map<AccountId, BridgeConnection>();
  private readonly all = new Set<BridgeConnection>();
  private readonly heartbeat: NodeJS.Timeout;
  private readonly now: () => Date;

  /**
   * @param deps Dependências.
   */
  constructor(private readonly deps: BridgeGatewayDeps) {
    this.now = deps.now ?? (() => new Date());
    this.heartbeat = setInterval(() => this.checkHeartbeat(), HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  /** @inheritdoc */
  canRequest(accountId: AccountId): boolean {
    return this.byAccount.get(accountId)?.socket.readyState === WebSocket.OPEN;
  }

  /** @inheritdoc */
  requestSnapshot(accountId: AccountId, requestId: string): boolean {
    const connection = this.byAccount.get(accountId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.send(connection, { v: PROTOCOL_VERSION, type: 'sync.request', requestId });
    return true;
  }

  /**
   * Pede à extensão da conta que traga a aba do jogo para a frente (ou a abra). Ação sobre o
   * navegador, não sobre o jogo (S0.1).
   *
   * @param accountId Conta.
   * @returns `true` se havia ponte conectada para receber o pedido.
   */
  focus(accountId: AccountId): boolean {
    const connection = this.byAccount.get(accountId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.send(connection, { v: PROTOCOL_VERSION, type: 'focus' });
    return true;
  }

  /** Contas com ponte conectada (diagnóstico). */
  connectedAccounts(): AccountId[] {
    return [...this.byAccount.keys()].sort();
  }

  /**
   * Aceita o upgrade de `/bridge`. A autenticação acontece na primeira mensagem (`hello`), pois
   * o WebSocket do navegador não permite cabeçalhos personalizados.
   *
   * @param req Requisição de upgrade.
   * @param socket Socket bruto.
   * @param head Primeiro pacote.
   */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    this.wss.handleUpgrade(req, socket, head, (ws) => this.accept(ws));
    return Promise.resolve();
  }

  /** Fecha todas as conexões. */
  close(): void {
    clearInterval(this.heartbeat);
    for (const connection of this.all) {
      connection.socket.terminate();
    }
    this.all.clear();
    this.byAccount.clear();
    this.wss.close();
  }

  private accept(socket: WebSocket): void {
    const connection: BridgeConnection = {
      socket,
      accountId: null,
      alive: true,
      windowStart: 0,
      windowCount: 0,
    };
    this.all.add(connection);
    const helloTimer = setTimeout(() => {
      if (connection.accountId === null) {
        socket.close(WS_CLOSE.bridgeAuthFailed, 'hello_timeout');
      }
    }, this.deps.helloTimeoutMs ?? HELLO_TIMEOUT_MS);
    socket.on('pong', () => {
      connection.alive = true;
    });
    socket.on('message', (data, isBinary) => {
      void this.onMessage(connection, data, isBinary).catch((err: unknown) => {
        this.deps.logger.error(
          { err, accountId: connection.accountId },
          'falha ao tratar mensagem da ponte',
        );
        this.send(connection, {
          v: PROTOCOL_VERSION,
          type: 'error',
          code: 'internal_error',
          message: 'Erro interno',
        });
      });
    });
    socket.on('close', () => {
      clearTimeout(helloTimer);
      this.all.delete(connection);
      if (
        connection.accountId !== null &&
        this.byAccount.get(connection.accountId) === connection
      ) {
        this.byAccount.delete(connection.accountId);
        this.deps.logger.info({ accountId: connection.accountId }, 'ponte desconectada');
      }
    });
    socket.on('error', (err) => this.deps.logger.warn({ err }, 'erro no WebSocket da ponte'));
  }

  private async onMessage(
    connection: BridgeConnection,
    data: RawData,
    isBinary: boolean,
  ): Promise<void> {
    let json: unknown;
    try {
      json = isBinary ? undefined : JSON.parse(rawToString(data));
    } catch {
      json = undefined;
    }
    const parsed = bridgeClientMessageSchema.safeParse(json);
    if (!parsed.success) {
      if (connection.accountId === null) {
        connection.socket.close(WS_CLOSE.bridgeAuthFailed, 'invalid_hello');
        return;
      }
      this.send(connection, {
        v: PROTOCOL_VERSION,
        type: 'error',
        code: 'invalid_message',
        message: 'Mensagem inválida',
      });
      return;
    }
    const message = parsed.data;

    if (message.type === 'hello') {
      await this.onHello(connection, message.token, message.extensionVersion);
      return;
    }
    if (connection.accountId === null) {
      connection.socket.close(WS_CLOSE.bridgeAuthFailed, 'hello_required');
      return;
    }
    if (message.type === 'ping') {
      return;
    }
    if (!this.withinRate(connection)) {
      this.send(connection, {
        v: PROTOCOL_VERSION,
        type: 'error',
        code: 'rate_limited',
        message: 'Snapshots demais',
      });
      return;
    }
    if (message.snapshot.accountId !== connection.accountId) {
      this.send(connection, {
        v: PROTOCOL_VERSION,
        type: 'error',
        code: 'account_mismatch',
        message: 'O snapshot não é da conta desta ponte',
      });
      return;
    }
    const status = await this.deps.sink.ingest(message.snapshot, this.now());
    this.send(connection, {
      v: PROTOCOL_VERSION,
      type: 'snapshot.ack',
      requestId: message.requestId,
      status,
    });
  }

  private async onHello(
    connection: BridgeConnection,
    token: string,
    extensionVersion: string,
  ): Promise<void> {
    if (connection.accountId !== null) {
      this.send(connection, {
        v: PROTOCOL_VERSION,
        type: 'error',
        code: 'already_authenticated',
        message: 'Já autenticado',
      });
      return;
    }
    const accountId = await this.deps.tokens.resolve(token);
    if (accountId === null) {
      this.deps.logger.warn('ponte recusada: token inválido');
      connection.socket.close(WS_CLOSE.bridgeAuthFailed, 'invalid_token');
      return;
    }
    const previous = this.byAccount.get(accountId);
    if (previous && previous !== connection) {
      previous.socket.close(WS_CLOSE.replaced, 'replaced');
    }
    connection.accountId = accountId;
    this.byAccount.set(accountId, connection);
    this.deps.logger.info({ accountId, extensionVersion }, 'ponte conectada');
    this.send(connection, { v: PROTOCOL_VERSION, type: 'hello.ok', accountId });
  }

  /** Janela fixa de 60 s por conexão. */
  private withinRate(connection: BridgeConnection): boolean {
    const nowMs = this.now().getTime();
    if (nowMs - connection.windowStart >= 60_000) {
      connection.windowStart = nowMs;
      connection.windowCount = 0;
    }
    connection.windowCount += 1;
    return connection.windowCount <= this.deps.snapshotsPerMinute;
  }

  private send(connection: BridgeConnection, message: BridgeServerMessage): void {
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.send(JSON.stringify(message));
    }
  }

  private checkHeartbeat(): void {
    for (const connection of this.all) {
      if (!connection.alive) {
        connection.socket.terminate();
        continue;
      }
      connection.alive = false;
      connection.socket.ping();
    }
  }
}
