/**
 * Contrato mínimo de controle da sincronização usado pelo WebSocket e pela rota `POST /sync`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { SyncState } from '@pokeidle-hub/shared';

/**
 * Controle da sincronização.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface SyncControl {
  /** Estado atual. */
  getState(): SyncState;
  /** Pede sincronização de todas as contas. Sem efeito se já houver uma rodada em andamento. */
  requestAll(): SyncState;
}
