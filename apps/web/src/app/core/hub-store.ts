/**
 * Estado central do painel em signals: as 4 contas, a sincronização, a conexão e o "Auto 30 s".
 * Recebe as atualizações do WebSocket e carrega o estado inicial por REST.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { AccountId, AccountView, AlertView, SyncState } from '@pokeidle-hub/shared';
import { SYNC_INTERVAL_MS } from '@pokeidle-hub/shared/domain';
import { ApiClient } from './api.client';
import { HubSocket } from './hub-socket';

const AUTO_SYNC_KEY = 'hub.autoSync';

/**
 * Resumo exibido na barra global.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface HubSummary {
  hunting: number;
  center: number;
  conflict: number;
  dailyDone: number;
  dailyTotal: number;
}

/**
 * Estado inicial da sincronização (antes do primeiro `sync.state`).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function emptySyncState(): SyncState {
  return {
    status: 'idle',
    startedAt: null,
    finishedAt: null,
    accounts: { '1': null, '2': null, '3': null, '4': null },
  };
}

/**
 * Store do painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Injectable({ providedIn: 'root' })
export class HubStore {
  private readonly api = inject(ApiClient);
  private readonly socket = inject(HubSocket);

  readonly accounts = signal<AccountView[]>([]);
  readonly sync = signal<SyncState>(emptySyncState());
  /** Alertas abertos. */
  readonly alerts = signal<AlertView[]>([]);
  readonly unackedAlerts = computed(() => this.alerts().filter((a) => !a.ackedAt).length);
  readonly loadError = signal<string | null>(null);
  readonly autoSync = signal<boolean>(readAutoSync());
  readonly connection = this.socket.state;
  readonly retryInMs = this.socket.retryInMs;

  readonly syncing = computed(() => this.sync().status === 'running');
  readonly lastSyncAt = computed(() => this.sync().finishedAt);
  readonly summary = computed<HubSummary>(() => summarize(this.accounts()));

  private autoTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    effect(() => {
      writeAutoSync(this.autoSync());
      this.restartAutoTimer(this.autoSync());
    });
  }

  /**
   * Conta pelo id.
   *
   * @param id Conta.
   * @returns Visão ou `undefined`.
   */
  account(id: AccountId): AccountView | undefined {
    return this.accounts().find((a) => a.accountId === id);
  }

  /** Conecta o WebSocket e carrega o estado inicial. */
  async start(): Promise<void> {
    this.unsubscribe ??= this.socket.onMessage((message) => {
      switch (message.type) {
        case 'account.updated':
          this.upsert(message.account);
          break;
        case 'sync.state':
          this.sync.set(message.state);
          break;
        case 'alert.opened':
          this.alerts.update((list) => [
            message.alert,
            ...list.filter((a) => a.id !== message.alert.id),
          ]);
          break;
        case 'alert.resolved':
          this.alerts.update((list) => list.filter((a) => a.id !== message.alert.id));
          break;
        case 'error':
          break;
      }
    });
    this.socket.start();
    await this.reload();
  }

  /** Para o WebSocket e o auto-sync. */
  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.socket.stop();
    this.restartAutoTimer(false);
  }

  /** Recarrega as contas por REST (estado inicial e após reconexão). */
  async reload(): Promise<void> {
    try {
      const { accounts } = await this.api.get<{ accounts: AccountView[] }>('/accounts');
      this.accounts.set(accounts);
      const { state } = await this.api.get<{ state: SyncState }>('/sync');
      this.sync.set(state);
      const { alerts } = await this.api.get<{ alerts: AlertView[] }>('/alerts');
      this.alerts.set(alerts);
      this.loadError.set(null);
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Falha ao carregar');
    }
  }

  /**
   * "Sincronizar tudo": pelo WebSocket quando aberto; senão, por REST. Sem efeito durante uma
   * rodada em andamento.
   */
  async syncAll(): Promise<void> {
    if (this.syncing()) {
      return;
    }
    if (!this.socket.send({ v: 1, type: 'sync.all' })) {
      try {
        const { state } = await this.api.post<{ state: SyncState }>('/sync');
        this.sync.set(state);
      } catch (error) {
        this.loadError.set(error instanceof Error ? error.message : 'Falha ao sincronizar');
      }
    }
  }

  /**
   * Alertas abertos de uma conta.
   *
   * @param id Conta.
   * @returns Alertas.
   */
  alertsOf(id: AccountId): AlertView[] {
    return this.alerts().filter((a) => a.accountId === id);
  }

  /**
   * Marca um alerta como visto.
   *
   * @param id Id do alerta.
   */
  async ackAlert(id: string): Promise<void> {
    const { alert } = await this.api.post<{ alert: AlertView }>(`/alerts/${id}/ack`);
    this.alerts.update((list) => list.map((a) => (a.id === id ? alert : a)));
  }

  /** Mensagem passageira para o usuário (ex.: resultado de "Abrir / focar conta"). */
  readonly notice = signal<string | null>(null);

  /**
   * Pede à extensão do perfil da conta para abrir ou focar a aba do jogo (F3-T5).
   *
   * @param accountId Conta.
   */
  async focusAccount(accountId: AccountId): Promise<void> {
    this.notice.set(null);
    try {
      await this.api.post(`/accounts/${accountId}/focus`);
      this.notice.set(`Conta ${accountId}: janela do jogo trazida para a frente.`);
    } catch {
      this.notice.set(
        `A ponte da Conta ${accountId} não está conectada. Abra o perfil desta conta no Brave e entre no jogo.`,
      );
    }
  }

  /**
   * Liga ou desliga o "Auto 30 s".
   *
   * @param on Novo estado.
   */
  setAutoSync(on: boolean): void {
    this.autoSync.set(on);
  }

  private upsert(view: AccountView): void {
    this.accounts.update((list) => {
      const index = list.findIndex((a) => a.accountId === view.accountId);
      if (index === -1) {
        return [...list, view].sort((a, b) => a.accountId - b.accountId);
      }
      const next = [...list];
      next[index] = view;
      return next;
    });
  }

  private restartAutoTimer(on: boolean): void {
    if (this.autoTimer !== null) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
    if (on) {
      // Não dispara com sincronização em andamento (PRD F1): syncAll() já ignora nesse caso.
      this.autoTimer = setInterval(() => void this.syncAll(), SYNC_INTERVAL_MS);
    }
  }
}

/**
 * Resumo das contas para a barra global.
 *
 * @param accounts Visões das contas.
 * @returns Contagens.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function summarize(accounts: readonly AccountView[]): HubSummary {
  const summary: HubSummary = { hunting: 0, center: 0, conflict: 0, dailyDone: 0, dailyTotal: 0 };
  for (const account of accounts) {
    const snap = account.stale ? null : account.snapshot;
    if (snap?.status === 'hunting') summary.hunting += 1;
    if (snap?.status === 'center') summary.center += 1;
    if (snap?.status === 'conflict') summary.conflict += 1;
    for (const done of [snap?.daily?.battlePassClaimedToday, snap?.daily?.topIdleVotedToday]) {
      if (done === true || done === false) {
        summary.dailyTotal += 1;
        if (done) summary.dailyDone += 1;
      }
    }
  }
  return summary;
}

function readAutoSync(): boolean {
  try {
    return localStorage.getItem(AUTO_SYNC_KEY) === 'on';
  } catch {
    return false;
  }
}

function writeAutoSync(on: boolean): void {
  try {
    localStorage.setItem(AUTO_SYNC_KEY, on ? 'on' : 'off');
  } catch {
    // Armazenamento indisponível (modo privado): o switch volta desligado no próximo acesso.
  }
}
