/**
 * Utilitários comuns aos WebSockets: leitura de cookie, checagem de origem e recusa do upgrade.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

/**
 * Lê um cookie do cabeçalho da requisição de upgrade.
 *
 * @param req Requisição HTTP do upgrade.
 * @param name Nome do cookie.
 * @returns Valor decodificado ou `undefined`.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function readCookie(req: IncomingMessage, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/**
 * Proteção contra Cross-Site WebSocket Hijacking: um navegador sempre envia `Origin`; aceita só
 * a origem do painel ou a mesma origem do host. Clientes fora do navegador (sem `Origin`) passam,
 * pois não carregam cookies da vítima.
 *
 * @param req Requisição de upgrade.
 * @param allowedOrigin Origem configurada do painel.
 * @returns `true` se a origem é aceitável.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function isAllowedOrigin(req: IncomingMessage, allowedOrigin: string): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }
  const host = req.headers.host;
  return (
    origin === new URL(allowedOrigin).origin ||
    (!!host && (origin === `https://${host}` || origin === `http://${host}`))
  );
}

/**
 * Recusa o upgrade com um status HTTP e fecha o socket.
 *
 * @param socket Socket bruto do upgrade.
 * @param status Status HTTP.
 * @param reason Texto do status.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}
