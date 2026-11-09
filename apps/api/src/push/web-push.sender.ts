/**
 * Envio real de Web Push com VAPID (biblioteca `web-push`).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { Agent } from 'node:https';
import webpush from 'web-push';
import type { PushSender, PushSubscriptionInput } from './push.service.js';

/**
 * Chaves VAPID do servidor.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  /** `mailto:` ou URL https que identifica o remetente para o serviço de push. */
  subject: string;
}

/**
 * Remetente Web Push.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class WebPushSender implements PushSender {
  /**
   * @param vapid Chaves VAPID.
   * @param agent Agente HTTPS opcional (testes com servidor local).
   */
  constructor(
    private readonly vapid: VapidConfig,
    private readonly agent?: Agent,
  ) {}

  /** @inheritdoc */
  async send(subscription: PushSubscriptionInput, payload: string): Promise<void> {
    await webpush.sendNotification(subscription, payload, {
      vapidDetails: this.vapid,
      TTL: 3600,
      urgency: 'high',
      ...(this.agent ? { agent: this.agent } : {}),
    });
  }
}
