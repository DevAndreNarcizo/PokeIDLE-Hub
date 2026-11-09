/**
 * Visão de uma conta entregue ao painel (REST `GET /accounts` e evento `account.updated`).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountId, AccountSnapshot } from '../snapshot/account-snapshot.schema.js';

/**
 * Estado consolidado de uma conta.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface AccountView {
  accountId: AccountId;
  label: string;
  nick: string | null;
  /** Último snapshot aceito, ou `null` se a conta nunca enviou dados. */
  snapshot: AccountSnapshot | null;
  /** Quando a API recebeu o último snapshot (ISO 8601 UTC). */
  receivedAt: string | null;
  /** `true` quando o dado está obsoleto no instante em que a visão foi montada. */
  stale: boolean;
}
