/**
 * `GET /accounts/:id/history?from&to&metric` (ARCHITECTURE.md §5): série temporal de uma conta.
 * Padrão: últimas 24 h de XP do treinador por hora. Intervalo máximo de 31 dias.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { accountIdSchema } from '@pokeidle-hub/shared';
import { HttpError } from '../http/errors.js';
import { HISTORY_METRICS } from './history.repository.js';
import type { HistoryMetric, HistoryRepository } from './history.repository.js';

const DAY_MS = 86_400_000;
const MAX_RANGE_MS = 31 * DAY_MS;

const querySchema = z.strictObject({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  metric: z
    .enum(Object.keys(HISTORY_METRICS) as [HistoryMetric, ...HistoryMetric[]])
    .default('xpTrainerPerHour'),
});

/**
 * Dependências da rota de histórico.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface HistoryRouterDeps {
  history: HistoryRepository;
  requireAuth: RequestHandler;
  now?: () => Date;
}

/**
 * Cria o roteador de histórico.
 *
 * @param deps Dependências.
 * @returns Roteador Express.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createHistoryRouter(deps: HistoryRouterDeps): Router {
  const now = deps.now ?? (() => new Date());
  const router = Router();
  router.get('/accounts/:id/history', deps.requireAuth, async (req, res) => {
    const accountId = accountIdSchema.safeParse(Number(req.params['id']));
    if (!accountId.success) {
      throw new HttpError(404, 'not_found', 'Conta não encontrada');
    }
    const query = querySchema.safeParse(req.query);
    if (!query.success) {
      throw new HttpError(
        400,
        'invalid_query',
        'Parâmetros inválidos',
        query.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      );
    }
    const to = query.data.to ? new Date(query.data.to) : now();
    const from = query.data.from ? new Date(query.data.from) : new Date(to.getTime() - DAY_MS);
    if (from > to || to.getTime() - from.getTime() > MAX_RANGE_MS) {
      throw new HttpError(400, 'invalid_range', 'Intervalo inválido (máximo de 31 dias)');
    }
    const points = await deps.history.series(accountId.data, from, to, query.data.metric);
    res.json({
      accountId: accountId.data,
      metric: query.data.metric,
      from: from.toISOString(),
      to: to.toISOString(),
      points,
    });
  });
  return router;
}
