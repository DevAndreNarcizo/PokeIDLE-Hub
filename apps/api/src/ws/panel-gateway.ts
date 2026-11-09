/**
 * WebSocket do painel (`/ws`, ARCHITECTURE.md §5): autentica pelo cookie de acesso no upgrade,
 * difunde `account.updated` e `sync.state` e recebe `sync.all`. A conexão é encerrada quando
 * o token de acesso expira (código 4001), para o painel renovar a sessão e reconectar.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import type { RawData } from 'ws';
import type { AccountView, AlertView, PanelServerMessage, SyncState } from '@pokeidle-hub/shared';
import { PROTOCOL_VERSION, WS_CLOSE, panelClientMessageSchema } from '@pokeidle-hub/shared';
import { ACCESS_COOKIE } from '../auth/cookies.js';
import type { AccessTokenService } from '../auth/tokens.js';
import type { HubEvents } from '../events/hub-events.js';
import type { Logger } from '../logger.js';
import type { SyncControl } from '../sync/sync-control.js';
import { isAllowedOrigin, readCookie, rejectUpgrade } from './ws-utils.js';

/** Tamanho máximo de uma mensagem do painel (só comandos pequenos). */
const MAX_PANEL_MESSAGE_BYTES = 4 * 1024;
/** Intervalo do ping de vida; conexão sem pong é derrubada. */
const HEARTBEAT_MS = 30_000;

/**
 * Dependências do gateway do painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface PanelGatewayDeps {
  tokens: AccessTokenService;
  events: HubEvents;
  sync: SyncControl;
  allowedOrigin: string;
  logger: Logger;
  now?: () => Date;
}

interface PanelClient {
  socket: WebSocket;
  alive: boolean;
  expiryTimer: NodeJS.Timeout;
}

/**
 * Gateway WebSocket do painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class PanelGateway {
  private readonly wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_PANEL_MESSAGE_BYTES,
  });
  private readonly clients = new Set<PanelClient>();
  private readonly heartbeat: NodeJS.Timeout;
  private readonly now: () => Date;
  private readonly onAccount = (account: AccountView): void => {
    this.broadcast({ v: PROTOCOL_VERSION, type: 'account.updated', account });
  };
  private readonly onSync = (state: SyncState): void => {
    this.broadcast({ v: PROTOCOL_VERSION, type: 'sync.state', state });
  };
  private readonly onAlertOpened = (alert: AlertView): void => {
    this.broadcast({ v: PROTOCOL_VERSION, type: 'alert.opened', alert });
  };
  private readonly onAlertResolved = (alert: AlertView): void => {
    this.broadcast({ v: PROTOCOL_VERSION, type: 'alert.resolved', alert });
  };

  /**
   * @param deps Dependências.
   */
  constructor(private readonly deps: PanelGatewayDeps) {
    this.now = deps.now ?? (() => new Date());
    deps.events.on('account.updated', this.onAccount);
    deps.events.on('sync.state', this.onSync);
    deps.events.on('alert.opened', this.onAlertOpened);
    deps.events.on('alert.resolved', this.onAlertResolved);
    this.heartbeat = setInterval(() => this.checkHeartbeat(), HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  /**
   * Trata o upgrade HTTP → WebSocket de `/ws`.
   *
   * @param req Requisição de upgrade.
   * @param socket Socket bruto.
   * @param head Primeiro pacote.
   */
  async handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    if (!isAllowedOrigin(req, this.deps.allowedOrigin)) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }
    const token = readCookie(req, ACCESS_COOKIE);
    const check = token ? await this.deps.tokens.verify(token) : null;
    if (!check?.ok) {
      rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.accept(ws, check.expiresAt));
  }

  /** Encerra todas as conexões e para de ouvir eventos. */
  close(): void {
    clearInterval(this.heartbeat);
    this.deps.events.off('account.updated', this.onAccount);
    this.deps.events.off('sync.state', this.onSync);
    this.deps.events.off('alert.opened', this.onAlertOpened);
    this.deps.events.off('alert.resolved', this.onAlertResolved);
    for (const client of this.clients) {
      clearTimeout(client.expiryTimer);
      client.socket.terminate();
    }
    this.clients.clear();
    this.wss.close();
  }

  private accept(socket: WebSocket, expiresAt: Date): void {
    const ttl = Math.max(0, expiresAt.getTime() - this.now().getTime());
    const client: PanelClient = {
      socket,
      alive: true,
      expiryTimer: setTimeout(() => socket.close(WS_CLOSE.tokenExpired, 'token_expired'), ttl),
    };
    this.clients.add(client);
    socket.on('pong', () => {
      client.alive = true;
    });
    socket.on('message', (data, isBinary) => this.onMessage(client, data, isBinary));
    socket.on('close', () => {
      clearTimeout(client.expiryTimer);
      this.clients.delete(client);
    });
    socket.on('error', (err) => this.deps.logger.warn({ err }, 'erro no WebSocket do painel'));
    // Estado inicial da sincronização para o painel recém-conectado.
    this.send(client, {
      v: PROTOCOL_VERSION,
      type: 'sync.state',
      state: this.deps.sync.getState(),
    });
  }

  private onMessage(client: PanelClient, data: RawData, isBinary: boolean): void {
    let json: unknown;
    try {
      json = isBinary ? undefined : JSON.parse(rawToString(data));
    } catch {
      json = undefined;
    }
    const parsed = panelClientMessageSchema.safeParse(json);
    if (!parsed.success) {
      this.send(client, {
        v: PROTOCOL_VERSION,
        type: 'error',
        code: 'invalid_message',
        message: 'Mensagem inválida',
      });
      return;
    }
    switch (parsed.data.type) {
      case 'sync.all':
        // O coordenador publica `sync.state` pelo barramento; nada a responder aqui.
        this.deps.sync.requestAll();
        break;
    }
  }

  private broadcast(message: PanelServerMessage): void {
    for (const client of this.clients) {
      this.send(client, message);
    }
  }

  private send(client: PanelClient, message: PanelServerMessage): void {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
    }
  }

  private checkHeartbeat(): void {
    for (const client of this.clients) {
      if (!client.alive) {
        client.socket.terminate();
        continue;
      }
      client.alive = false;
      client.socket.ping();
    }
  }
}

/**
 * Converte o payload recebido pelo `ws` em texto UTF-8.
 *
 * @param data Payload bruto.
 * @returns Texto.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function rawToString(data: RawData): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8');
  }
  return Buffer.from(data as ArrayBuffer).toString('utf8');
}
