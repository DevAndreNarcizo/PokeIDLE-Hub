/**
 * Marcas de "desatualizado" impostas pela sincronização: conta que não respondeu em 10 s (ou sem
 * ponte) fica obsoleta mesmo que o último dado ainda seja recente (ARCHITECTURE.md §7, passo 5).
 * A marca sai quando a conta volta a responder.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountId } from '@pokeidle-hub/shared';

/**
 * Conjunto de contas marcadas como obsoletas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class StaleMarks {
  private readonly marked = new Set<AccountId>();

  /** Marca a conta. */
  mark(accountId: AccountId): void {
    this.marked.add(accountId);
  }

  /** Remove a marca; devolve `true` se a conta estava marcada. */
  clear(accountId: AccountId): boolean {
    return this.marked.delete(accountId);
  }

  /** Se a conta está marcada. */
  has(accountId: AccountId): boolean {
    return this.marked.has(accountId);
  }
}
