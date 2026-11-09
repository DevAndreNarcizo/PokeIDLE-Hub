/**
 * Rotas de push: chave pública VAPID, inscrição, cancelamento e teste.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../http/errors.js';
import type { PushService } from './push.service.js';

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith('https://').max(1000),
  keys: z.strictObject({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/**
 * Cria o roteador de push.
 *
 * @param push Serviço (ausente = push desativado por falta de chaves VAPID).
 * @param publicKey Chave pública VAPID.
 * @param requireAuth Middleware de sessão.
 * @returns Roteador Express.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createPushRouter(
  push: Pick<PushService, 'subscribe' | 'unsubscribe' | 'sendTest'> | null,
  publicKey: string | null,
  requireAuth: RequestHandler,
): Router {
  const router = Router();
  const enabled = (): Pick<PushService, 'subscribe' | 'unsubscribe' | 'sendTest'> => {
    if (!push || !publicKey) {
      throw new HttpError(
        503,
        'push_disabled',
        'Notificações não configuradas no servidor (chaves VAPID)',
      );
    }
    return push;
  };

  router.get('/push/public-key', requireAuth, (_req, res) => {
    enabled();
    res.json({ publicKey });
  });

  router.post('/push/subscribe', requireAuth, async (req, res) => {
    const service = enabled();
    const parsed = subscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'invalid_subscription', 'Inscrição inválida');
    }
    await service.subscribe(parsed.data, req.get('user-agent')?.slice(0, 300) ?? null);
    res.status(201).json({ status: 'subscribed' });
  });

  router.post('/push/unsubscribe', requireAuth, async (req, res) => {
    const service = enabled();
    const endpoint = z.object({ endpoint: z.string().max(1000) }).safeParse(req.body);
    if (!endpoint.success) {
      throw new HttpError(400, 'invalid_body', 'Informe o endpoint');
    }
    await service.unsubscribe(endpoint.data.endpoint);
    res.status(204).end();
  });

  router.post('/push/test', requireAuth, async (_req, res) => {
    res.json(await enabled().sendTest());
  });

  return router;
}
