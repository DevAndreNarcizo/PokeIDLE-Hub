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
import { BridgeGateway } from './bridge/bridge-gateway.js';
import { BridgeTokenService } from './bridge/bridge-token.service.js';
import { EnvValidationError, loadEnv } from './config/env.js';
import type { Env } from './config/env.js';
import { createPrismaClient, pingDatabase } from './db/client.js';
import { HubEvents } from './events/hub-events.js';
import { HistoryRepository } from './history/history.repository.js';
import { SnapshotService } from './ingest/snapshot.service.js';
import { RetentionJob } from './jobs/retention.job.js';
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
  const history = new HistoryRepository(prisma);
  const retention = new RetentionJob({
    history,
    retentionDays: env.SNAPSHOT_RETENTION_DAYS,
    logger,
  });

  // Provedores de status (ARCHITECTURE.md §1): a ponte da extensão é a fonte aprovada no S0.2.
  // A entrada manual não é pedida pela sincronização; chega por POST /accounts/:id/snapshot.
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
  const bridge = new BridgeGateway({
    tokens: bridgeTokens,
    sink,
    logger,
    snapshotsPerMinute: env.INGEST_RATE_PER_MINUTE,
  });
  providers.push(bridge);

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
    accounts: { accounts, manualSink: sink },
    sync: coordinator,
    history: { history },
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
  retention.start();
  attachWebSockets(server, { '/ws': panel, '/bridge': bridge }, logger);

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'encerrando');
    coordinator.dispose();
    retention.stop();
    panel.close();
    bridge.close();
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
