/**
 * Web Push (F4-T4): guarda as inscrições dos aparelhos do dono e envia uma notificação a cada
 * alerta aberto. Inscrição que o serviço de push dá como inexistente (404/410) é removida.
 * O formato do payload segue o service worker do Angular (`notification` + `onActionClick`).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AlertView } from '@pokeidle-hub/shared';
import { alertText } from '@pokeidle-hub/shared';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { Logger } from '../logger.js';

/**
 * Inscrição de push do navegador.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Envio de uma mensagem para uma inscrição. Lança erro com `statusCode` em falha.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface PushSender {
  send(subscription: PushSubscriptionInput, payload: string): Promise<void>;
}

/**
 * Resultado de um envio para todos os aparelhos.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface PushResult {
  sent: number;
  removed: number;
  failed: number;
}

/**
 * Monta o payload de notificação no formato do `@angular/service-worker`.
 *
 * @param title Título.
 * @param body Texto.
 * @param tag Agrupador (substitui notificação anterior do mesmo tipo).
 * @returns JSON do payload.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function buildPayload(title: string, body: string, tag: string): string {
  return JSON.stringify({
    notification: {
      title,
      body,
      tag,
      icon: 'icons/icon-192x192.png',
      badge: 'icons/icon-72x72.png',
      lang: 'pt-BR',
      data: { onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: '/' } } },
    },
  });
}

/**
 * Serviço de push.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class PushService {
  /**
   * @param prisma Cliente Prisma.
   * @param sender Envio (Web Push com VAPID em produção).
   * @param logger Logger.
   */
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sender: PushSender,
    private readonly logger: Logger,
  ) {}

  /**
   * Registra (ou atualiza) a inscrição de um aparelho.
   *
   * @param input Inscrição.
   * @param userAgent Navegador, para identificação.
   */
  async subscribe(input: PushSubscriptionInput, userAgent: string | null): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent,
      },
      update: { p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent },
    });
  }

  /**
   * Remove a inscrição de um aparelho.
   *
   * @param endpoint Endpoint da inscrição.
   */
  async unsubscribe(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  /**
   * Notifica um alerta aberto.
   *
   * @param alert Alerta.
   * @param accountLabel Nome da conta.
   * @returns Resultado do envio.
   */
  notifyAlert(alert: AlertView, accountLabel: string): Promise<PushResult> {
    return this.broadcast(
      buildPayload(
        `PokeIdle Hub · ${accountLabel}`,
        alertText(alert),
        `alert-${alert.kind}-${String(alert.accountId)}`,
      ),
    );
  }

  /**
   * Mensagem livre para todos os aparelhos (ex.: alarme do /health).
   *
   * @param title Título.
   * @param body Texto.
   * @param tag Agrupador.
   * @returns Resultado do envio.
   */
  sendMessage(title: string, body: string, tag: string): Promise<PushResult> {
    return this.broadcast(buildPayload(title, body, tag));
  }

  /**
   * Notificação de teste para todos os aparelhos.
   *
   * @returns Resultado do envio.
   */
  sendTest(): Promise<PushResult> {
    return this.broadcast(
      buildPayload('PokeIdle Hub', 'Notificações funcionando neste aparelho.', 'test'),
    );
  }

  private async broadcast(payload: string): Promise<PushResult> {
    const subscriptions = await this.prisma.pushSubscription.findMany();
    const result: PushResult = { sent: 0, removed: 0, failed: 0 };
    await Promise.all(
      subscriptions.map(async (s) => {
        try {
          await this.sender.send(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          result.sent += 1;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await this.unsubscribe(s.endpoint);
            result.removed += 1;
          } else {
            result.failed += 1;
            this.logger.warn({ err, status }, 'falha ao enviar push');
          }
        }
      }),
    );
    return result;
  }
}
