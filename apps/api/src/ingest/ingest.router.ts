/**
 * `POST /ingest/snapshot`: a extensão envia o snapshot de uma conta (ARCHITECTURE.md §5).
 * Autenticado pelo token da conta, validado com zod e limitado por conta.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { parseAccountSnapshot } from '@pokeidle-hub/shared';
import { requireBridgeToken } from '../bridge/bridge-auth.middleware.js';
import type { BridgeTokenResolver } from '../bridge/bridge-token.service.js';
import { HttpError } from '../http/errors.js';
import type { SnapshotSink } from './snapshot-sink.js';

/**
 * Dependências da rota de ingestão.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface IngestRouterDeps {
  bridgeTokens: BridgeTokenResolver;
  sink: SnapshotSink;
  /** Snapshots aceitos por conta por minuto. */
  ratePerMinute: number;
  now?: () => Date;
}

/**
 * Cria o roteador de ingestão.
 *
 * @param deps Dependências.
 * @returns Roteador Express.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createIngestRouter(deps: IngestRouterDeps): Router {
  const now = deps.now ?? (() => new Date());
  const router = Router();

  const limiter = rateLimit({
    windowMs: 60_000,
    limit: deps.ratePerMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (_req, res) => `account-${String(res.locals['bridgeAccountId'])}`,
    handler: (_req, _res, next) => {
      next(new HttpError(429, 'rate_limited', 'Snapshots demais para esta conta'));
    },
  });

  router.post(
    '/ingest/snapshot',
    requireBridgeToken(deps.bridgeTokens),
    limiter,
    async (req, res) => {
      const parsed = parseAccountSnapshot(req.body);
      if (!parsed.ok) {
        throw new HttpError(400, 'invalid_snapshot', 'Snapshot inválido', parsed.issues);
      }
      if (parsed.snapshot.accountId !== res.locals['bridgeAccountId']) {
        throw new HttpError(403, 'account_mismatch', 'O token não pertence a esta conta');
      }
      const outcome = await deps.sink.ingest(parsed.snapshot, now());
      res.status(outcome === 'stored' ? 201 : 200).json({ status: outcome });
    },
  );

  return router;
}
