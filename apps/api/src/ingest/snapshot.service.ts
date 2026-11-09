/**
 * Implementação do {@link SnapshotSink}: grava no PostgreSQL e, quando o snapshot é novo, publica
 * `account.updated` para o painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountSnapshot } from '@pokeidle-hub/shared';
import type { AccountRepository } from '../accounts/account.repository.js';
import type { HubEvents } from '../events/hub-events.js';
import type { IngestOutcome, SnapshotSink } from './snapshot-sink.js';

/**
 * Serviço de ingestão persistente.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class SnapshotService implements SnapshotSink {
  /**
   * @param accounts Repositório das contas.
   * @param events Barramento de eventos.
   * @param now Relógio injetável.
   */
  constructor(
    private readonly accounts: AccountRepository,
    private readonly events: HubEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** @inheritdoc */
  async ingest(snapshot: AccountSnapshot, receivedAt: Date): Promise<IngestOutcome> {
    const stored = await this.accounts.saveIfNewer(snapshot, receivedAt);
    if (!stored) {
      return 'duplicate';
    }
    const view = await this.accounts.getView(snapshot.accountId, this.now());
    if (view) {
      this.events.emit('account.updated', view);
    }
    return 'stored';
  }
}
