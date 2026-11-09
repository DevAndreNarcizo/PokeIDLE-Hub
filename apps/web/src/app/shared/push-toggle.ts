/**
 * Botão "Notificações neste aparelho" (push PWA, F4-T4).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PanelPush } from '../core/push.service';

/**
 * Liga/desliga as notificações do aparelho atual.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Component({
  selector: 'hub-push-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (push.state()) {
      @case ('unsupported') {}
      @case ('denied') {
        <span class="hint">Notificações bloqueadas no navegador</span>
      }
      @case ('server_disabled') {
        <span class="hint">Notificações não configuradas no servidor</span>
      }
      @default {
        <button
          type="button"
          class="btn"
          role="switch"
          [attr.aria-checked]="push.state() === 'on'"
          [disabled]="push.state() === 'busy'"
          (click)="toggle()"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"
            />
          </svg>
          {{ label() }}
        </button>
        @if (push.state() === 'on') {
          <button type="button" class="btn ghost" (click)="push.test()">Testar</button>
        }
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .hint {
      color: var(--muted);
      font-size: 12px;
    }
    .btn[aria-checked='true'] {
      border-color: var(--ok);
    }
    .ghost {
      background: transparent;
    }
  `,
})
export class PushToggle {
  protected readonly push = inject(PanelPush);
  protected readonly label = computed(() =>
    this.push.state() === 'on'
      ? 'Alertas neste aparelho: ligados'
      : 'Ativar alertas neste aparelho',
  );

  protected toggle(): void {
    void (this.push.state() === 'on' ? this.push.disable() : this.push.enable());
  }
}
