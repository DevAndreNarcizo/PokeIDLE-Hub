/**
 * `GET /accounts`: último estado das 4 contas (ARCHITECTURE.md §5). Exige sessão do painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { accountIdSchema, parseAccountSnapshot } from '@pokeidle-hub/shared';
import { HttpError } from '../http/errors.js';
import type { SnapshotSink } from '../ingest/snapshot-sink.js';
import type { AccountRepository } from './account.repository.js';

/**
 * Dependências das rotas de contas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface AccountsRouterDeps {
  accounts: AccountRepository;
  requireAuth: RequestHandler;
  /** Destino da entrada manual (fallback do provedor de status). */
  manualSink?: SnapshotSink;
  now?: () => Date;
}

/**
 * Cria o roteador de contas.
 *
 * @param deps Dependências.
 * @returns Roteador Express.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createAccountsRouter(deps: AccountsRouterDeps): Router {
  const now = deps.now ?? (() => new Date());
  const router = Router();
  router.get('/accounts', deps.requireAuth, async (_req, res) => {
    res.json({ accounts: await deps.accounts.listViews(now()) });
  });

  // Entrada manual (provedor `manual`, ARCHITECTURE.md §1): o dono informa o estado pelo painel.
  router.post('/accounts/:id/snapshot', deps.requireAuth, async (req, res) => {
    const sink = deps.manualSink;
    const accountId = accountIdSchema.safeParse(Number(req.params['id']));
    if (!sink || !accountId.success) {
      throw new HttpError(404, 'not_found', 'Conta não encontrada');
    }
    const parsed = parseAccountSnapshot(req.body);
    if (!parsed.ok) {
      throw new HttpError(400, 'invalid_snapshot', 'Snapshot inválido', parsed.issues);
    }
    if (parsed.snapshot.accountId !== accountId.data || parsed.snapshot.source !== 'manual') {
      throw new HttpError(
        400,
        'invalid_snapshot',
        'Conta ou origem não conferem (use source "manual")',
      );
    }
    const status = await sink.ingest(parsed.snapshot, now());
    res.status(status === 'stored' ? 201 : 200).json({ status });
  });
  return router;
}
