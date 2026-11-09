/**
 * Painel de uma conta (DESIGN.md §3; no celular, §4): cabeçalho com status, banner, cartão
 * "Sessão do jogo" (substitui o viewport, que o jogo bloqueia — S0.1), equipe, métricas, boosts,
 * automações e diário.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { AccountId, AccountView, AlertView } from '@pokeidle-hub/shared';
import { alertText } from '@pokeidle-hub/shared/domain';
import { formatInt, formatRemaining, formatShortClock } from '../../../core/format';
import {
  automationsOf,
  bannersOf,
  huntLabel,
  liveSnapshot,
  metricsOf,
  statusOf,
  teamOf,
} from './account-model';

/**
 * Painel da conta.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Component({
  selector: 'hub-account-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-panel.html',
  styleUrl: './account-panel.scss',
  imports: [NgTemplateOutlet],
  host: { '[class.compact]': 'compact()' },
})
export class AccountPanel {
  readonly account = input.required<AccountView>();
  /** Layout de celular (sem cabeçalho numerado, conteúdo em uma coluna). */
  readonly compact = input(false);
  /** Instante de referência para tempos restantes (atualizado pelo painel). */
  readonly now = input<Date>(new Date());
  /** Alertas abertos da conta (F4-T3). */
  readonly alerts = input<readonly AlertView[]>([]);
  /** "Ciente" em um alerta. */
  readonly ackAlert = output<string>();
  /** Pedido para abrir/focar a janela da conta (F3-T5). */
  readonly focusAccount = output<AccountId>();

  protected readonly name = computed(() => this.account().nick ?? this.account().label);
  protected readonly status = computed(() => statusOf(this.account()));
  protected readonly banners = computed(() => bannersOf(this.account()));
  protected readonly metrics = computed(() => metricsOf(this.account()));
  protected readonly team = computed(() => teamOf(this.account()));
  protected readonly live = computed(() => liveSnapshot(this.account()));
  protected readonly automations = computed(() => automationsOf(this.live()));
  protected readonly hunt = computed(() => huntLabel(this.account().snapshot));
  protected readonly level = computed(() => {
    const level = this.account().snapshot?.trainerLevel;
    return level ? `Treinador nv ${formatInt(level)}` : 'Nível desconhecido';
  });
  protected readonly lastData = computed(() => formatShortClock(this.account().receivedAt));
  protected readonly boosts = computed(() =>
    (this.live()?.boosts ?? []).map((b) => ({
      kind: b.kind,
      detail: b.note ?? formatRemaining(b.expiresAt, this.now()),
    })),
  );
  protected readonly daily = computed(() => {
    const daily = this.live()?.daily;
    if (!daily) {
      return null;
    }
    return {
      pass: daily.battlePassClaimedToday,
      passDay: daily.battlePassDay,
      vote: daily.topIdleVotedToday,
    };
  });

  /** Alertas que os banners não cobrem (boost, diário). */
  protected readonly extraAlerts = computed(() =>
    this.alerts()
      .filter((a) => a.kind === 'boost_expiring' || a.kind === 'daily_pending')
      .map((a) => ({ id: a.id, text: alertText(a), acked: a.ackedAt !== null })),
  );

  protected requestFocus(): void {
    this.focusAccount.emit(this.account().accountId);
  }
}
