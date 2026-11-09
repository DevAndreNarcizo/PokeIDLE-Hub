/**
 * `GET /accounts`: último estado das 4 contas (ARCHITECTURE.md §5). Exige sessão do painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { AccountRepository } from './account.repository.js';

/**
 * Dependências das rotas de contas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface AccountsRouterDeps {
  accounts: AccountRepository;
  requireAuth: RequestHandler;
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
  return router;
}
