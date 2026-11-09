/**
 * Utilitário de linha de comando para os tokens da ponte.
 *
 * Uso:
 *   npm run bridge-token -w @pokeidle-hub/api -- issue <conta>   # emite e mostra uma única vez
 *   npm run bridge-token -w @pokeidle-hub/api -- revoke <conta>  # revoga
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { accountIdSchema } from '@pokeidle-hub/shared';
import { BridgeTokenService } from '../bridge/bridge-token.service.js';
import { loadEnv } from '../config/env.js';
import { createPrismaClient } from '../db/client.js';

async function main(): Promise<void> {
  const [command, rawAccount] = process.argv.slice(2);
  const account = accountIdSchema.safeParse(Number(rawAccount));
  if ((command !== 'issue' && command !== 'revoke') || !account.success) {
    process.stderr.write('Uso: bridge-token <issue|revoke> <1-4>\n');
    process.exit(1);
  }
  const env = loadEnv();
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const service = new BridgeTokenService(prisma);
    if (command === 'issue') {
      const token = await service.issue(account.data);
      process.stderr.write(
        `Token da Conta ${account.data} (copie agora; não será mostrado de novo):\n`,
      );
      process.stdout.write(`${token}\n`);
    } else {
      await service.revoke(account.data);
      process.stderr.write(`Token da Conta ${account.data} revogado.\n`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
