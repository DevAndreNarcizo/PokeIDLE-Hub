/**
 * Barramento de eventos interno da API. Desacopla quem produz mudanças (ingestão, sincronização)
 * de quem as difunde (WebSocket do painel).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { EventEmitter } from 'node:events';
import type { AccountView, AlertView, SyncState } from '@pokeidle-hub/shared';

/**
 * Mapa de eventos e seus argumentos.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface HubEventMap {
  'account.updated': [view: AccountView];
  'sync.state': [state: SyncState];
  'alert.opened': [alert: AlertView];
  'alert.resolved': [alert: AlertView];
}

/**
 * Emissor tipado dos eventos do hub.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class HubEvents extends EventEmitter<HubEventMap> {}
