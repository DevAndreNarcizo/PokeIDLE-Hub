/**
 * Content script da aba do jogo: só responde pedidos de leitura do service worker. Não altera o
 * DOM, não dispara eventos e não faz requisições (somente leitura, CLAUDE.md regra 3).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { isReadRequest } from './messages.js';
import { readSnapshot } from './reader/read-snapshot.js';

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isReadRequest(message)) {
    return false;
  }
  sendResponse(readSnapshot(document, message.accountId, new Date()));
  return false;
});
