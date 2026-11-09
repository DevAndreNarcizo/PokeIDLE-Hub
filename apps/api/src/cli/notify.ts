/**
 * Envia uma notificação push para os aparelhos inscritos sem depender da API estar no ar (lê as
 * inscrições direto do banco). Usado pelo alarme do /health (deploy/healthcheck.sh).
 *
 * Uso: node --env-file=.env apps/api/dist/cli/notify.js "<título>" "<mensagem>" [tag]
 * Saída: 0 enviado; 2 push não configurado (sem VAPID); 1 erro.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { loadEnv } from '../config/env.js';
import { createPrismaClient } from '../db/client.js';
import { createLogger } from '../logger.js';
import { PushService } from '../push/push.service.js';
import { WebPushSender } from '../push/web-push.sender.js';

async function main(): Promise<void> {
  const [title, body, tag = 'hub'] = process.argv.slice(2);
  if (!title || !body) {
    process.stderr.write('Uso: notify "<título>" "<mensagem>" [tag]\n');
    process.exit(1);
  }
  const env = loadEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    process.stderr.write('Push não configurado (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY).\n');
    process.exit(2);
  }
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const push = new PushService(
      prisma,
      new WebPushSender({
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT ?? new URL(env.CORS_ORIGIN).origin,
      }),
      createLogger('warn'),
    );
    const result = await push.sendMessage(title, body, tag);
    process.stdout.write(`push: ${result.sent} enviado(s), ${result.removed} removido(s), ${result.failed} falha(s)\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`notify falhou: ${String(error)}\n`);
  process.exit(1);
});
