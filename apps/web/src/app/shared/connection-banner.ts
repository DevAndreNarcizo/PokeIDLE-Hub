/**
 * Aviso de conexão: com o WebSocket fora, mostra o erro e deixa claro que os dados exibidos são
 * os últimos recebidos (PRD F1: nunca mostrar dado velho como atual).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HubStore } from '../core/hub-store';

/**
 * Banner de conexão.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Component({
  selector: 'hub-connection-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <div class="banner" role="alert">
        <span class="icon" aria-hidden="true">!</span>
        <span>{{ text }}</span>
      </div>
    }
  `,
  styles: `
    .banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border: 1px solid var(--warn);
      border-radius: var(--radius-card);
      background: color-mix(in srgb, var(--warn) 10%, var(--surface));
    }
    .icon {
      display: inline-grid;
      place-items: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--warn);
      color: var(--accent-ink);
      font-weight: 700;
      font-size: 12px;
    }
  `,
})
export class ConnectionBanner {
  private readonly store = inject(HubStore);
  protected readonly message = computed(() => {
    const retry = this.store.retryInMs();
    if (this.store.connection() === 'error') {
      const seconds = retry ? Math.round(retry / 1000) : null;
      return `Sem conexão com o hub. Mostrando o último estado (desatualizado).${seconds ? ` Nova tentativa em ${seconds} s.` : ''}`;
    }
    return this.store.loadError();
  });
}
