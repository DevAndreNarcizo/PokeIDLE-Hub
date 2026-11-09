/**
 * Painel principal: barra global e as 4 contas (grid 2×2 no ultrawide, abas no celular).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { OnDestroy, OnInit } from '@angular/core';
import { HubStore } from '../../core/hub-store';
import { ConnectionBanner } from '../../shared/connection-banner';

/**
 * Página do painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Component({
  selector: 'hub-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConnectionBanner],
  template: `
    <main class="root">
      <hub-connection-banner />
    </main>
  `,
  styles: `
    .root {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 20px;
      min-height: 100dvh;
    }
  `,
})
export class DashboardPage implements OnInit, OnDestroy {
  protected readonly store = inject(HubStore);

  ngOnInit(): void {
    void this.store.start();
  }

  ngOnDestroy(): void {
    this.store.stop();
  }
}
