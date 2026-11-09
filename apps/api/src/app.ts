/**
 * Montagem da aplicação Express: segurança básica, logs de requisição, rotas e tratamento de
 * erros. Recebe dependências por injeção para facilitar testes sem rede nem banco.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import cookieParser from 'cookie-parser';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { createAccountsRouter } from './accounts/accounts.router.js';
import type { AccountsRouterDeps } from './accounts/accounts.router.js';
import { requireAuth } from './auth/auth.middleware.js';
import { createAuthRouter } from './auth/auth.router.js';
import type { AuthRouterDeps } from './auth/auth.router.js';
import type { Env } from './config/env.js';
import { createCors } from './http/cors.js';
import { createErrorHandler, notFoundHandler } from './http/errors.js';
import { createHealthRouter } from './http/health.js';
import { createHistoryRouter } from './history/history.router.js';
import type { HistoryRouterDeps } from './history/history.router.js';
import { createIngestRouter } from './ingest/ingest.router.js';
import type { IngestRouterDeps } from './ingest/ingest.router.js';
import type { HealthCheck } from './http/health.js';
import type { Logger } from './logger.js';
import type { SyncControl } from './sync/sync-control.js';
import { createSyncRouter } from './sync/sync.router.js';

/** Tamanho máximo do corpo JSON (ARCHITECTURE.md §9: limite de payload). */
const MAX_JSON_BODY = '64kb';

/**
 * Dependências da aplicação HTTP.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface AppDeps {
  env: Pick<Env, 'NODE_ENV' | 'CORS_ORIGIN'>;
  logger: Logger;
  version: string;
  healthChecks?: Readonly<Record<string, HealthCheck>>;
  /** Autenticação do painel; ausente só em testes que não envolvem rotas protegidas. */
  auth?: Omit<AuthRouterDeps, 'logger'>;
  /** Ingestão de snapshots pela ponte. */
  ingest?: IngestRouterDeps;
  /** Rotas de contas (exigem `auth`). */
  accounts?: Omit<AccountsRouterDeps, 'requireAuth'>;
  /** Controle da sincronização (exige `auth`). */
  sync?: SyncControl;
  /** Histórico (exige `auth`). */
  history?: Omit<HistoryRouterDeps, 'requireAuth'>;
}

/**
 * Cria a aplicação Express.
 *
 * @param deps Dependências injetadas.
 * @returns Aplicação pronta para `listen` ou para testes com supertest.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // atrás do nginx local (ARCHITECTURE.md §10)
  app.use(helmet());
  app.use(
    pinoHttp({ logger: deps.logger, autoLogging: { ignore: (req) => req.url === '/health' } }),
  );
  app.use(createCors(deps.env.CORS_ORIGIN));
  app.use(express.json({ limit: MAX_JSON_BODY }));
  app.use(cookieParser());

  app.use(createHealthRouter(deps.healthChecks ?? {}, deps.version));

  if (deps.auth) {
    const authenticated = requireAuth(deps.auth.tokens);
    app.use(createAuthRouter({ ...deps.auth, logger: deps.logger }));
    // Consulta de sessão: o painel usa para saber se precisa mostrar o login.
    app.get('/auth/session', authenticated, (_req, res) => {
      res.json({ authenticated: true });
    });
    if (deps.accounts) {
      app.use(createAccountsRouter({ ...deps.accounts, requireAuth: authenticated }));
    }
    if (deps.sync) {
      app.use(createSyncRouter(deps.sync, authenticated));
    }
    if (deps.history) {
      app.use(createHistoryRouter({ ...deps.history, requireAuth: authenticated }));
    }
  }

  if (deps.ingest) {
    app.use(createIngestRouter(deps.ingest));
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));
  return app;
}
