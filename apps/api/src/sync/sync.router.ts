/**
 * `POST /sync`: pede sincronização de todas as contas (ARCHITECTURE.md §5). Responde 202 com o
 * estado atual; o progresso chega pelo WebSocket (`sync.state`).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { SyncControl } from './sync-control.js';

/**
 * Cria o roteador de sincronização.
 *
 * @param sync Controle da sincronização.
 * @param requireAuth Middleware de sessão do painel.
 * @returns Roteador Express.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createSyncRouter(sync: SyncControl, requireAuth: RequestHandler): Router {
  const router = Router();
  router.post('/sync', requireAuth, (_req, res) => {
    res.status(202).json({ state: sync.requestAll() });
  });
  router.get('/sync', requireAuth, (_req, res) => {
    res.json({ state: sync.getState() });
  });
  return router;
}
