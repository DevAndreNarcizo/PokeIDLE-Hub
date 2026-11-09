/**
 * Painel principal: barra global e as 4 contas (grid 2×2 no ultrawide, coluna única em telas
 * menores e abas no celular).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { OnDestroy, OnInit } from '@angular/core';
import type { AccountId } from '@pokeidle-hub/shared';
import { HubStore } from '../../core/hub-store';
import { Viewport } from '../../core/viewport';
import { ConnectionBanner } from '../../shared/connection-banner';
import { AccountPanel } from './account-panel/account-panel';
import { GlobalBar } from './global-bar/global-bar';

/**
 * Página do painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Component({
  selector: 'hub-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConnectionBanner, GlobalBar, AccountPanel],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit, OnDestroy {
  protected readonly store = inject(HubStore);
  protected readonly viewport = inject(Viewport);
  /** Relógio para tempos restantes (boosts), atualizado a cada 30 s. */
  protected readonly now = signal(new Date());
  private clock: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    void this.store.start();
    this.clock = setInterval(() => this.now.set(new Date()), 30_000);
  }

  ngOnDestroy(): void {
    this.store.stop();
    if (this.clock !== null) {
      clearInterval(this.clock);
    }
  }

  protected onFocus(accountId: AccountId): void {
    void this.store.focusAccount(accountId);
  }
}
