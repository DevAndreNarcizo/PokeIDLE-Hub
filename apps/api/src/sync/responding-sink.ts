/**
 * Decorador do {@link SnapshotSink} que avisa o coordenador quando uma conta responde, seja pela
 * rota HTTP ou pela ponte WebSocket.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountSnapshot } from '@pokeidle-hub/shared';
import type { IngestOutcome, SnapshotSink } from '../ingest/snapshot-sink.js';
import type { SyncCoordinator } from './sync.coordinator.js';

/**
 * Sink que registra respostas na sincronização.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class RespondingSink implements SnapshotSink {
  /**
   * @param inner Sink real.
   * @param coordinator Coordenador da sincronização.
   */
  constructor(
    private readonly inner: SnapshotSink,
    private readonly coordinator: Pick<SyncCoordinator, 'noteResponse'>,
  ) {}

  /** @inheritdoc */
  async ingest(snapshot: AccountSnapshot, receivedAt: Date): Promise<IngestOutcome> {
    const outcome = await this.inner.ingest(snapshot, receivedAt);
    this.coordinator.noteResponse(snapshot.accountId);
    return outcome;
  }
}
