/**
 * Seed idempotente das 4 contas (ARCHITECTURE.md §6) e do catálogo de hunts (F5-T1). Rótulos genéricos "Conta N"; apelidos
 * ficam nulos até o dono informar (OPEN_QUESTIONS.md #8).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { createPrismaClient } from '../src/db/client.js';
import { seedCatalog } from '../src/hunts/hunt-catalog.js';

const ACCOUNT_IDS = [1, 2, 3, 4] as const;

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL ausente');
  }
  const prisma = createPrismaClient(databaseUrl);
  try {
    for (const id of ACCOUNT_IDS) {
      await prisma.account.upsert({
        where: { id },
        update: {},
        create: { id, label: `Conta ${id}` },
      });
    }
    process.stdout.write(`seed: ${ACCOUNT_IDS.length} contas garantidas\n`);
    process.stdout.write(`seed: ${await seedCatalog(prisma)} hunts no catálogo (GAME_RULES.md)\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`seed falhou: ${String(error)}\n`);
  process.exit(1);
});
