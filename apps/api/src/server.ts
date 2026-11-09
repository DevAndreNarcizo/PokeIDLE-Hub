/**
 * Ponto de entrada do processo da API (raiz de composição): valida o ambiente, monta os serviços,
 * sobe o HTTP e os WebSockets e faz o desligamento gracioso.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { AccountRepository } from './accounts/account.repository.js';
import { AlertService } from './alerts/alert.service.js';
import { createApp } from './app.js';
import { createArgon2Verifier } from './auth/password.js';
import { PrismaRefreshTokenStore } from './auth/refresh-token.store.js';
import { AccessTokenService } from './auth/tokens.js';
import { BridgeGateway } from './bridge/bridge-gateway.js';
import { BridgeTokenService } from './bridge/bridge-token.service.js';
import { EnvValidationError, loadEnv } from './config/env.js';
import type { Env } from './config/env.js';
import { DailyRepository } from './daily/daily.repository.js';
import { createPrismaClient, pingDatabase } from './db/client.js';
import { HubEvents } from './events/hub-events.js';
import { HistoryRepository } from './history/history.repository.js';
import { SnapshotService } from './ingest/snapshot.service.js';
import { startAlertClock } from './jobs/alert-clock.job.js';
import { RetentionJob } from './jobs/retention.job.js';
import { HuntsService } from './hunts/hunts.service.js';
import { ObservationRecorder } from './hunts/observation.recorder.js';
import { createLogger } from './logger.js';
import { PushService } from './push/push.service.js';
import { WebPushSender } from './push/web-push.sender.js';
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
  const daily = new DailyRepository(prisma);
  const observations = new ObservationRecorder(prisma);
  const retention = new RetentionJob({
    history,
    retentionDays: env.SNAPSHOT_RETENTION_DAYS,
    logger,
  });

  const alerts = new AlertService({
    prisma,
    views: accounts,
    daily,
    events,
    logger,
    reminderAt: env.DAILY_REMINDER_TIME,
  });

  // Web Push: ativo só com as duas chaves VAPID; cada alerta aberto vira notificação.
  const vapidReady = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  const push =
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
      ? new PushService(
          prisma,
          new WebPushSender({
            publicKey: env.VAPID_PUBLIC_KEY,
            privateKey: env.VAPID_PRIVATE_KEY,
            subject: env.VAPID_SUBJECT ?? new URL(env.CORS_ORIGIN).origin,
          }),
          logger,
        )
      : null;
  if (push) {
    events.on('alert.opened', (alert) => {
      const id = alert.accountId;
      void (id === null ? Promise.resolve(null) : accounts.getView(id, new Date()))
        .then((view) => push.notifyAlert(alert, view ? (view.nick ?? view.label) : 'Hub'))
        .catch((err: unknown) => logger.error({ err }, 'falha ao notificar alerta'));
    });
  } else {
    logger.warn('Web Push desativado: defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY');
  }

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
    new SnapshotService(accounts, events, () => new Date(), staleMarks, [
      (snapshot) => daily.recordFromSnapshot(snapshot),
      (snapshot) => observations.record(snapshot),
      (snapshot, receivedAt) => alerts.evaluate(snapshot.accountId, receivedAt),
    ]),
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
      publicPrefix: env.API_PUBLIC_PREFIX,
      loginRateLimit: {
        max: env.LOGIN_RATE_LIMIT_MAX,
        windowSeconds: env.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
      },
    },
    ingest: { bridgeTokens, sink, ratePerMinute: env.INGEST_RATE_PER_MINUTE },
    accounts: { accounts, manualSink: sink, focus: bridge },
    sync: coordinator,
    history: { history },
    alerts,
    hunts: new HuntsService(prisma, accounts),
    push: { service: push, publicKey: vapidReady ? (env.VAPID_PUBLIC_KEY ?? null) : null },
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
  const stopAlertClock = startAlertClock(alerts);
  attachWebSockets(server, { '/ws': panel, '/bridge': bridge }, logger);

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'encerrando');
    coordinator.dispose();
    retention.stop();
    stopAlertClock();
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
