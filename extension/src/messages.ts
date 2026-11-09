/**
 * Mensagens internas da extensão (service worker ↔ content script).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountId } from '@pokeidle-hub/shared';

/**
 * Pedido de leitura enviado à aba do jogo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface ReadRequest {
  type: 'hub.read';
  accountId: AccountId;
}

/**
 * Identifica um {@link ReadRequest}.
 *
 * @param value Mensagem recebida.
 * @returns `true` se for um pedido de leitura válido.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function isReadRequest(value: unknown): value is ReadRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const msg = value as Record<string, unknown>;
  return msg['type'] === 'hub.read' && [1, 2, 3, 4].includes(msg['accountId'] as number);
}
