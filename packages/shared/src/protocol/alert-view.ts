/**
 * Alerta como o painel o recebe (REST `GET /alerts` e eventos `alert.opened`/`alert.resolved`).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AlertKind } from '../domain/alerts.js';
import type { AccountId } from '../snapshot/account-snapshot.schema.js';

/**
 * Alerta persistido.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface AlertView {
  id: string;
  accountId: AccountId | null;
  kind: AlertKind;
  openedAt: string;
  resolvedAt: string | null;
  ackedAt: string | null;
  payload: Record<string, unknown> | null;
}
