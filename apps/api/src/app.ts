/**
 * Montagem da aplicação Express: segurança básica, logs de requisição, rotas e tratamento de
 * erros. Recebe dependências por injeção para facilitar testes sem rede nem banco.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Env } from './config/env.js';
import { createErrorHandler, notFoundHandler } from './http/errors.js';
import { createHealthRouter } from './http/health.js';
import type { HealthCheck } from './http/health.js';
import type { Logger } from './logger.js';

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
  app.use(express.json({ limit: MAX_JSON_BODY }));

  app.use(createHealthRouter(deps.healthChecks ?? {}, deps.version));

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));
  return app;
}
