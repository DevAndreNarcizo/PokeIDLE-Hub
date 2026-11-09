/**
 * Encaminha os pedidos de upgrade do servidor HTTP para o gateway WebSocket de cada caminho.
 * Caminho desconhecido é recusado com 404.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Logger } from '../logger.js';
import { rejectUpgrade } from './ws-utils.js';

/**
 * Gateway capaz de assumir um upgrade.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface UpgradeHandler {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void>;
}

/**
 * Registra os gateways por caminho no servidor HTTP.
 *
 * @param server Servidor HTTP.
 * @param routes Caminho → gateway (ex.: `{ '/ws': panel, '/bridge': bridge }`).
 * @param logger Logger.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function attachWebSockets(
  server: Server,
  routes: Readonly<Record<string, UpgradeHandler>>,
  logger: Logger,
): void {
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', (err) => logger.debug({ err }, 'erro no socket de upgrade'));
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const handler = routes[path];
    if (!handler) {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }
    handler.handleUpgrade(req, socket, head).catch((err: unknown) => {
      logger.error({ err }, 'falha no upgrade WebSocket');
      rejectUpgrade(socket, 500, 'Internal Server Error');
    });
  });
}
