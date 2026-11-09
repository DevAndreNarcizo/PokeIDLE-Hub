/**
 * Fonte de status das contas (ARCHITECTURE.md §1): a API não fala com o jogo; ela pede snapshots
 * a um provedor e os recebe pela ingestão. Isola a origem dos dados atrás de uma interface.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountId, SnapshotSource } from '@pokeidle-hub/shared';

/**
 * Provedor de status.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface StatusProvider {
  /** Origem dos snapshots que este provedor produz. */
  readonly kind: SnapshotSource;
  /** Se o provedor consegue pedir dados desta conta agora (ex.: ponte conectada). */
  canRequest(accountId: AccountId): boolean;
  /**
   * Pede um snapshot. A resposta chega depois, pela ingestão.
   *
   * @returns `true` se o pedido foi enviado.
   */
  requestSnapshot(accountId: AccountId, requestId: string): boolean;
}
