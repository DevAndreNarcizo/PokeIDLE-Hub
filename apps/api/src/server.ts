/**
 * Ponto de entrada do processo da API: valida o ambiente, cria o logger e sobe o servidor HTTP
 * com desligamento gracioso.
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
import { createPrismaClient, pingDatabase } from './db/client.js';
import { HubEvents } from './events/hub-events.js';
import { SnapshotService } from './ingest/snapshot.service.js';
import { createLogger } from './logger.js';

const API_VERSION = process.env['npm_package_version'] ?? '0.1.0';

function main(): void {
  let env;
  try {
    env = loadEnv();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      // Sem configuração válida não há logger configurado; stderr é o canal correto.
      process.stderr.write(`${error.message}\nVeja .env.example.\n`);
      process.exit(1);
    }
    throw error;
  }

  const logger = createLogger(env.LOG_LEVEL);
  const prisma = createPrismaClient(env.DATABASE_URL);
  const events = new HubEvents();
  const accounts = new AccountRepository(prisma);
  const snapshots = new SnapshotService(accounts, events);
  const bridgeTokens = new BridgeTokenService(prisma);
  const app = createApp({
    env,
    logger,
    version: API_VERSION,
    healthChecks: { database: () => pingDatabase(prisma) },
    auth: {
      tokens: new AccessTokenService(env.HUB_JWT_SECRET, env.ACCESS_TOKEN_TTL_SECONDS),
      refreshStore: new PrismaRefreshTokenStore(prisma),
      verifyPassword: createArgon2Verifier(env.HUB_ADMIN_PASSWORD_HASH),
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      loginRateLimit: {
        max: env.LOGIN_RATE_LIMIT_MAX,
        windowSeconds: env.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
      },
    },
    ingest: { bridgeTokens, sink: snapshots, ratePerMinute: env.INGEST_RATE_PER_MINUTE },
    accounts: { accounts },
  });
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API no ar');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'encerrando');
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
