/**
 * Notificações push neste aparelho (F4-T4): pede permissão, inscreve com a chave VAPID do hub e
 * registra a inscrição na API. Depende do service worker (só no build de produção, em HTTPS).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { ApiClient, ApiError } from './api.client';

/**
 * Estado das notificações no aparelho.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type PushState = 'unsupported' | 'off' | 'on' | 'denied' | 'busy' | 'server_disabled';

/**
 * Serviço de notificações do painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Injectable({ providedIn: 'root' })
export class PanelPush {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(ApiClient);
  readonly state = signal<PushState>('unsupported');

  constructor() {
    if (!this.swPush.isEnabled) {
      return;
    }
    this.state.set(
      typeof Notification !== 'undefined' && Notification.permission === 'denied'
        ? 'denied'
        : 'off',
    );
    this.swPush.subscription.subscribe((sub) => {
      if (this.state() !== 'busy' && this.state() !== 'denied') {
        this.state.set(sub ? 'on' : 'off');
      }
    });
  }

  /** Liga as notificações neste aparelho. */
  async enable(): Promise<void> {
    this.state.set('busy');
    try {
      const { publicKey } = await this.api.get<{ publicKey: string }>('/push/public-key');
      const subscription = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
      await this.api.post('/push/subscribe', subscription.toJSON());
      this.state.set('on');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'push_disabled') {
        this.state.set('server_disabled');
      } else {
        this.state.set(
          typeof Notification !== 'undefined' && Notification.permission === 'denied'
            ? 'denied'
            : 'off',
        );
      }
    }
  }

  /** Desliga as notificações neste aparelho. */
  async disable(): Promise<void> {
    this.state.set('busy');
    try {
      const sub = await firstValueFrom(this.swPush.subscription);
      if (sub) {
        await this.api.post('/push/unsubscribe', { endpoint: sub.endpoint });
        await this.swPush.unsubscribe();
      }
    } finally {
      this.state.set('off');
    }
  }

  /** Envia uma notificação de teste para todos os aparelhos inscritos. */
  async test(): Promise<void> {
    await this.api.post('/push/test');
  }
}
