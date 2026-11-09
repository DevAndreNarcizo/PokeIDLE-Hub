/**
 * Barra global (DESIGN.md §3 e §4): marca, resumo das contas, próximos eventos, "Auto 30 s",
 * última sincronização e "Sincronizar tudo". No celular vira um cabeçalho compacto.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { formatClock } from '../../../core/format';
import { HubStore } from '../../../core/hub-store';
import { PushToggle } from '../../../shared/push-toggle';
import type { UpcomingEventView } from '../../../shared/upcoming-event';

/**
 * Barra global de sincronização.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Component({
  selector: 'hub-global-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './global-bar.html',
  styleUrl: './global-bar.scss',
  host: { '[class.compact]': 'compact()' },
  imports: [PushToggle],
})
export class GlobalBar {
  protected readonly store = inject(HubStore);

  /** Layout de celular. */
  readonly compact = input(false);
  /** Próximos eventos (o primeiro urgente em destaque). */
  readonly events = input<readonly UpcomingEventView[]>([]);

  protected readonly lastSync = computed(() => formatClock(this.store.lastSyncAt()));
  protected readonly summary = this.store.summary;
  protected readonly syncing = this.store.syncing;

  protected toggleAuto(): void {
    this.store.setAutoSync(!this.store.autoSync());
  }

  protected sync(): void {
    void this.store.syncAll();
  }
}
