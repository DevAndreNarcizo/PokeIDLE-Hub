/**
 * `GET /hunts?accountId&metric&region` (ARCHITECTURE.md §5).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../http/errors.js';
import type { HuntsService } from './hunts.service.js';

const querySchema = z.strictObject({
  accountId: z.coerce.number().int().min(1).max(4),
  metric: z.enum(['xp', 'gold', 'shiny', 'rares']).default('xp'),
  region: z.string().min(1).max(32).optional(),
});

/**
 * Cria o roteador de hunts.
 *
 * @param hunts Serviço de hunts.
 * @param requireAuth Middleware de sessão.
 * @param now Relógio.
 * @returns Roteador Express.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createHuntsRouter(
  hunts: Pick<HuntsService, 'list'>,
  requireAuth: RequestHandler,
  now: () => Date = () => new Date(),
): Router {
  const router = Router();
  router.get('/hunts', requireAuth, async (req, res) => {
    const query = querySchema.safeParse(req.query);
    if (!query.success) {
      throw new HttpError(400, 'invalid_query', 'Parâmetros inválidos');
    }
    const { accountId, metric, region } = query.data;
    res.json(await hunts.list(accountId as 1 | 2 | 3 | 4, metric, region ?? null, now()));
  });
  return router;
}
