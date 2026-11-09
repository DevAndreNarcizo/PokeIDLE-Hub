/**
 * Job diário de retenção (ARCHITECTURE.md §6): apaga snapshots com mais de N dias (padrão 30).
 * Roda ao subir a API e depois a cada 24 h. O downsample opcional não foi implementado.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { HistoryRepository } from '../history/history.repository.js';
import type { Logger } from '../logger.js';

const DAY_MS = 86_400_000;

/**
 * Dependências do job.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface RetentionJobDeps {
  history: Pick<HistoryRepository, 'deleteOlderThan'>;
  retentionDays: number;
  logger: Logger;
  now?: () => Date;
}

/**
 * Job de retenção.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class RetentionJob {
  private timer: NodeJS.Timeout | null = null;
  private readonly now: () => Date;

  /**
   * @param deps Dependências.
   */
  constructor(private readonly deps: RetentionJobDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * Executa uma rodada.
   *
   * @returns Quantidade de snapshots apagados.
   */
  async runOnce(): Promise<number> {
    const cutoff = new Date(this.now().getTime() - this.deps.retentionDays * DAY_MS);
    const deleted = await this.deps.history.deleteOlderThan(cutoff);
    this.deps.logger.info({ deleted, cutoff: cutoff.toISOString() }, 'retenção de snapshots');
    return deleted;
  }

  /** Agenda a execução imediata e diária. */
  start(): void {
    const run = (): void => {
      this.runOnce().catch((err: unknown) => this.deps.logger.error({ err }, 'falha na retenção'));
    };
    run();
    this.timer = setInterval(run, DAY_MS);
    this.timer.unref();
  }

  /** Cancela o agendamento. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
