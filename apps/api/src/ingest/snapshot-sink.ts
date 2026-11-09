/**
 * Contrato do destino dos snapshots validados. Separa a ingestão (HTTP ou ponte WebSocket) da
 * persistência e da difusão para o painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountSnapshot } from '@pokeidle-hub/shared';

/**
 * Resultado da ingestão: `stored` quando o snapshot é mais novo que o último gravado;
 * `duplicate` quando `capturedAt` ≤ o último (descartado, ARCHITECTURE.md §7).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type IngestOutcome = 'stored' | 'duplicate';

/**
 * Destino de snapshots já validados.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface SnapshotSink {
  ingest(snapshot: AccountSnapshot, receivedAt: Date): Promise<IngestOutcome>;
}
