/**
 * Content script da aba do jogo: guarda o último estado repassado pelo script da página (vindo da
 * /hunt for PokeIdle, quando instalada) e responde aos pedidos de leitura do service worker. Não
 * altera o DOM, não dispara eventos e não faz requisições (somente leitura, CLAUDE.md regra 3).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { HuntState } from './hunt/hunt-state.js';
import { PAGE_BRIDGE_SOURCE } from './hunt/hunt-state.js';
import { SessionTracker } from './hunt/session-tracker.js';
import { isReadRequest } from './messages.js';
import { readSnapshot } from './reader/read-snapshot.js';

let huntState: { state: HuntState; receivedAt: number } | null = null;
const tracker = new SessionTracker();

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  // Só mensagens da própria página, com o formato esperado. O conteúdo é validado de novo no
  // mapeamento e na API (schema zod).
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data as { source?: unknown; type?: unknown; state?: unknown } | null;
  if (
    data?.source !== PAGE_BRIDGE_SOURCE ||
    data.type !== 'hunt-state' ||
    typeof data.state !== 'object' ||
    !data.state
  ) {
    return;
  }
  huntState = { state: data.state as HuntState, receivedAt: Date.now() };
  tracker.update(huntState.state, huntState.receivedAt);
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isReadRequest(message)) {
    return false;
  }
  sendResponse(readSnapshot(document, message.accountId, new Date(), huntState, tracker.session()));
  return false;
});
