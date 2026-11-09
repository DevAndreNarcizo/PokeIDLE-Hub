/**
 * Ponto de entrada do processo da API (raiz de composição): valida o ambiente, monta os serviços,
 * sobe o HTTP e os WebSockets e faz o desligamento gracioso.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { AccountRepository } from './accounts/account.repository.js';
import { createApp } from './app.js';
import { createArgon2Verifier } from './auth/password.js';
import { PrismaRefreshTokenStore } from './auth/refresh-token.store.js';
import { AccessTokenService } from './auth/tokens.js';
import { BridgeTokenService } from './bridge/bridge-token.service.js';
import { EnvValidationError, loadEnv } from './config/env.js';
import type { Env } from './config/env.js';
import { createPrismaClient, pingDatabase } from './db/client.js';
import { HubEvents } from './events/hub-events.js';
import { SnapshotService } from './ingest/snapshot.service.js';
import { createLogger } from './logger.js';
import { RespondingSink } from './sync/responding-sink.js';
import { StaleMarks } from './sync/stale-marks.js';
import type { StatusProvider } from './sync/status-provider.js';
import { SyncCoordinator } from './sync/sync.coordinator.js';
import { attachWebSockets } from './ws/attach.js';
import { PanelGateway } from './ws/panel-gateway.js';

const API_VERSION = process.env['npm_package_version'] ?? '0.1.0';

function readEnv(): Env {
  try {
    return loadEnv();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      // Sem configuração válida não há logger configurado; stderr é o canal correto.
      process.stderr.write(`${error.message}\nVeja .env.example.\n`);
      process.exit(1);
    }
    throw error;
  }
}

function main(): void {
  const env = readEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const prisma = createPrismaClient(env.DATABASE_URL);

  const events = new HubEvents();
  const staleMarks = new StaleMarks();
  const accounts = new AccountRepository(prisma, staleMarks);
  const tokens = new AccessTokenService(env.HUB_JWT_SECRET, env.ACCESS_TOKEN_TTL_SECONDS);
  const bridgeTokens = new BridgeTokenService(prisma);

  // Provedores de status: a ponte da extensão entra aqui (F2-T5).
  const providers: StatusProvider[] = [];
  const coordinator = new SyncCoordinator({
    providers,
    events,
    staleMarks,
    views: accounts,
    logger,
  });
  const sink = new RespondingSink(
    new SnapshotService(accounts, events, () => new Date(), staleMarks),
    coordinator,
  );

  const app = createApp({
    env,
    logger,
    version: API_VERSION,
    healthChecks: { database: () => pingDatabase(prisma) },
    auth: {
      tokens,
      refreshStore: new PrismaRefreshTokenStore(prisma),
      verifyPassword: createArgon2Verifier(env.HUB_ADMIN_PASSWORD_HASH),
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      loginRateLimit: {
        max: env.LOGIN_RATE_LIMIT_MAX,
        windowSeconds: env.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
      },
    },
    ingest: { bridgeTokens, sink, ratePerMinute: env.INGEST_RATE_PER_MINUTE },
    accounts: { accounts },
    sync: coordinator,
  });

  const panel = new PanelGateway({
    tokens,
    events,
    sync: coordinator,
    allowedOrigin: env.CORS_ORIGIN,
    logger,
  });

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API no ar');
  });
  attachWebSockets(server, { '/ws': panel }, logger);

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'encerrando');
    coordinator.dispose();
    panel.close();
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
