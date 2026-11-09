/**
 * Coordenador da sincronização global (ARCHITECTURE.md §7): pede snapshot a todas as contas,
 * acompanha as respostas, aplica o prazo de 10 s por conta e publica `sync.state`. Uma rodada por
 * vez: pedidos durante uma rodada em andamento são ignorados (PRD F1).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { randomUUID } from 'node:crypto';
import type { AccountId, AccountSyncResult, AccountView, SyncState } from '@pokeidle-hub/shared';
import { SYNC_TIMEOUT_MS, initialSyncState } from '@pokeidle-hub/shared';
import type { HubEvents } from '../events/hub-events.js';
import type { Logger } from '../logger.js';
import type { StaleMarks } from './stale-marks.js';
import type { StatusProvider } from './status-provider.js';
import type { SyncControl } from './sync-control.js';

const ACCOUNT_IDS: readonly AccountId[] = [1, 2, 3, 4];

/**
 * Leitura da visão de uma conta (para republicar quando a marca de obsoleto muda).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface AccountViewReader {
  getView(accountId: AccountId, now: Date): Promise<AccountView | null>;
}

/**
 * Dependências do coordenador.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface SyncCoordinatorDeps {
  providers: readonly StatusProvider[];
  events: HubEvents;
  staleMarks: StaleMarks;
  views: AccountViewReader;
  logger: Logger;
  timeoutMs?: number;
  now?: () => Date;
}

/**
 * Coordenador de sincronização.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class SyncCoordinator implements SyncControl {
  private state: SyncState = initialSyncState();
  private timer: NodeJS.Timeout | null = null;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  /**
   * @param deps Dependências.
   */
  constructor(private readonly deps: SyncCoordinatorDeps) {
    this.now = deps.now ?? (() => new Date());
    this.timeoutMs = deps.timeoutMs ?? SYNC_TIMEOUT_MS;
  }

  /** @inheritdoc */
  getState(): SyncState {
    return structuredClone(this.state);
  }

  /** @inheritdoc */
  requestAll(): SyncState {
    if (this.state.status === 'running') {
      return this.getState();
    }
    const requestId = randomUUID();
    const accounts = { ...this.state.accounts };
    for (const accountId of ACCOUNT_IDS) {
      const provider = this.deps.providers.find((p) => p.canRequest(accountId));
      const sent = provider?.requestSnapshot(accountId, requestId) ?? false;
      accounts[key(accountId)] = sent ? 'pending' : 'unavailable';
      if (!sent) {
        this.markStale(accountId);
      }
    }
    this.state = {
      status: 'running',
      startedAt: this.now().toISOString(),
      finishedAt: null,
      accounts,
    };
    this.deps.logger.info({ requestId, accounts }, 'sincronização iniciada');
    this.publish();
    if (this.pendingCount() === 0) {
      this.finish();
    } else {
      this.timer = setTimeout(() => this.onTimeout(), this.timeoutMs);
    }
    return this.getState();
  }

  /**
   * Registra que a conta respondeu (snapshot recebido, novo ou duplicado). Chamado pela ingestão.
   *
   * @param accountId Conta que respondeu.
   */
  noteResponse(accountId: AccountId): void {
    if (this.deps.staleMarks.clear(accountId)) {
      void this.republish(accountId);
    }
    if (this.state.status !== 'running' || this.state.accounts[key(accountId)] !== 'pending') {
      return;
    }
    this.state.accounts[key(accountId)] = 'ok';
    if (this.pendingCount() === 0) {
      this.finish();
    } else {
      this.publish();
    }
  }

  /** Cancela o temporizador (encerramento do processo). */
  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private onTimeout(): void {
    this.timer = null;
    for (const accountId of ACCOUNT_IDS) {
      if (this.state.accounts[key(accountId)] === 'pending') {
        this.state.accounts[key(accountId)] = 'timeout';
        this.markStale(accountId);
      }
    }
    this.finish();
  }

  private finish(): void {
    this.dispose();
    this.state = { ...this.state, status: 'idle', finishedAt: this.now().toISOString() };
    this.deps.logger.info({ accounts: this.state.accounts }, 'sincronização concluída');
    this.publish();
  }

  private markStale(accountId: AccountId): void {
    if (!this.deps.staleMarks.has(accountId)) {
      this.deps.staleMarks.mark(accountId);
      void this.republish(accountId);
    }
  }

  private async republish(accountId: AccountId): Promise<void> {
    try {
      const view = await this.deps.views.getView(accountId, this.now());
      if (view) {
        this.deps.events.emit('account.updated', view);
      }
    } catch (err) {
      this.deps.logger.error({ err, accountId }, 'falha ao republicar conta');
    }
  }

  private pendingCount(): number {
    return Object.values(this.state.accounts).filter(
      (r: AccountSyncResult | null) => r === 'pending',
    ).length;
  }

  private publish(): void {
    this.deps.events.emit('sync.state', this.getState());
  }
}

function key(accountId: AccountId): '1' | '2' | '3' | '4' {
  return String(accountId) as '1' | '2' | '3' | '4';
}
