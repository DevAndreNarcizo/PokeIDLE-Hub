/**
 * Rotas de alertas (ARCHITECTURE.md §5): `GET /alerts` e `POST /alerts/:id/ack`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { HttpError } from '../http/errors.js';
import type { AlertService } from './alert.service.js';

/**
 * Cria o roteador de alertas.
 *
 * @param alerts Serviço de alertas.
 * @param requireAuth Middleware de sessão.
 * @param now Relógio.
 * @returns Roteador Express.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createAlertsRouter(
  alerts: Pick<AlertService, 'list' | 'ack'>,
  requireAuth: RequestHandler,
  now: () => Date = () => new Date(),
): Router {
  const router = Router();
  router.get('/alerts', requireAuth, async (req, res) => {
    const scope = req.query['scope'] === 'recent' ? 'recent' : 'open';
    res.json({ alerts: await alerts.list(scope, now()) });
  });
  router.post('/alerts/:id/ack', requireAuth, async (req, res) => {
    const raw = String(req.params['id'] ?? '');
    if (!/^\d{1,18}$/.test(raw)) {
      throw new HttpError(404, 'not_found', 'Alerta não encontrado');
    }
    const alert = await alerts.ack(BigInt(raw), now());
    if (!alert) {
      throw new HttpError(404, 'not_found', 'Alerta não encontrado');
    }
    res.json({ alert });
  });
  return router;
}
