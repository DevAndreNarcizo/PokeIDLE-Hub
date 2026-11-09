/**
 * Apoio aos testes de integração com PostgreSQL. Só rodam quando `TEST_DATABASE_URL` aponta para
 * um banco migrado e descartável (nunca o banco de desenvolvimento).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { createPrismaClient } from '../../src/db/client.js';
import type { PrismaClient } from '../../src/db/client.js';

/** URL do banco de teste, ou `undefined` para pular os testes de integração. */
export const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];

/** Cria um cliente para o banco de teste. */
export function testPrisma(): PrismaClient {
  return createPrismaClient(TEST_DATABASE_URL ?? '');
}

/** Limpa todas as tabelas e recria as 4 contas. */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE snapshots, account_state, alerts, daily_tasks, hunt_observations, refresh_tokens, push_subscriptions, accounts RESTART IDENTITY CASCADE',
  );
  await prisma.account.createMany({
    data: [1, 2, 3, 4].map((id) => ({ id, label: `Conta ${id}` })),
  });
}
