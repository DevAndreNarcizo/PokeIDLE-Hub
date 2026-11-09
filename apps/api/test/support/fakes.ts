/**
 * Dublês de teste em memória para a ingestão.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountId, AccountSnapshot } from '@pokeidle-hub/shared';
import type { BridgeTokenResolver } from '../../src/bridge/bridge-token.service.js';
import type { IngestOutcome, SnapshotSink } from '../../src/ingest/snapshot-sink.js';

/** Resolver com tokens fixos (valores fictícios). */
export class FakeBridgeTokens implements BridgeTokenResolver {
  constructor(private readonly tokens: Record<string, AccountId>) {}

  resolve(token: string): Promise<AccountId | null> {
    return Promise.resolve(this.tokens[token] ?? null);
  }
}

/** Sink em memória que reproduz a regra de idempotência por `capturedAt`. */
export class InMemorySink implements SnapshotSink {
  readonly stored: AccountSnapshot[] = [];
  private readonly latest = new Map<AccountId, number>();

  ingest(snapshot: AccountSnapshot): Promise<IngestOutcome> {
    const at = Date.parse(snapshot.capturedAt);
    const last = this.latest.get(snapshot.accountId);
    if (last !== undefined && at <= last) {
      return Promise.resolve('duplicate');
    }
    this.latest.set(snapshot.accountId, at);
    this.stored.push(snapshot);
    return Promise.resolve('stored');
  }
}
